/**
 * Direct scalar and structural Fin through installed wasm32 PHP APIs.
 * These reports remain separate from earlier product/record acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { checkInstalledPhpWasmFixture, phpWasmFinCaller, phpWasmFinConsumer } from "./php-wasm-fin-fixtures.mjs";
import { phpWasmDirectContainers, phpWasmDirectScalar } from "./php-wasm-fin-direct-fixtures.mjs";
import { finContainerEdgeConsumer, finContainerEdgeSource } from "./fin-container-edges.mjs";
import { nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const fixtures = async t => ({ scalar: phpWasmDirectScalar, containers: await phpWasmDirectContainers(t) });

test("direct PHP-Wasm Fin fixtures preserve native callers, full container edges and independent reviews", async t => {
	const selected = await fixtures(t);
	const native = await readFile("tests/php-fin.test.mjs", "utf8");
	const template = native.match(/const phpFinConsumer = \(\) => `([^]*?)`;/u)?.[1];
	assert.ok(template); assert.ok(!template.includes("${"));
	const scalar = await readFile(selected.scalar.consumer, "utf8");
	const withoutAutoload = source => source.replace("require 'vendor/autoload.php';\n", "");
	assert.equal(withoutAutoload(scalar), withoutAutoload(template.replaceAll("\\\\", "\\")));
	assert.equal(await readFile(selected.containers.consumer, "utf8"), await finContainerEdgeConsumer("php-native"));
	assert.equal(await readFile(join(selected.containers.root, "FinContainers.lean"), "utf8"), await finContainerEdgeSource());
	assert.equal(Object.keys(selected.scalar.refinements).length, 7);
	assert.equal(Object.keys(selected.containers.refinements).length, 12);
	for(const fixture of Object.values(selected))
	{
		const ir = fixture.review(); validateBindingIr(ir);
		assert.deepEqual(ir.declarations.map(item => item.source.declaration).sort(), Object.keys(fixture.refinements).sort());
		for(const declaration of ir.declarations)
			declaration.parameters.forEach((parameter, index) => assert.equal(parameter.name, `arg${index}`));
		compileCopiedPhpModel(ir, { integerBits: 32, structuredCallables: true, lists: true, variants: true });
		const { source, request } = await phpWasmFinCaller(fixture), original = await readFile(fixture.consumer, "utf8");
		for(const mode of ["weak", "strict"])
		{
			assert.equal(source(mode), phpWasmFinConsumer(original, mode));
			assert.match(source(mode), /'word_bits' => PHP_INT_SIZE \* 8/u);
		}
		for(const arrangement of ["embedded", "composer"])
			assert.equal(JSON.parse(request(arrangement)).module, fixture.namespace);
	}
});

for(const reviewed of [false, true]) test(`${reviewed ? "reviewed" : "ordinary"} installed PHP-Wasm direct Fin scalars and containers execute in Node and Chromium`, {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_TEST !== "1"
	, timeout: 3600000
}, async t => {
	const reports = [];
	for(const [name, fixture] of Object.entries(await fixtures(t)))
	{
		const verifyModel = model => assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), fixture.refinements);
		const spec = { ...fixture, label: `direct-fin-${name}`
			, exports: Object.keys(fixture.refinements)
			, verifyModel, minimumChecks: name === "scalar" ? 2000 : 14000, reviewed };
		const { readme, report } = await checkInstalledPhpWasmFixture(t, spec);
		for(const execution of report.phpWasm.executions) assert.equal(execution.observation.checks, name === "scalar" ? 2028 : 14089);
		assert.match(readme, /\n## Bounded integers\n/u);
		const fixtureSources = {
			leanSha256: sha256(await readFile(join(fixture.root, fixture.module + ".lean")))
			, phpSha256: sha256(await readFile(fixture.consumer))
		};
		reports.push({ fixture: name, fixtureSources, refinements: fixture.refinements, ...report });
	}
	const variable = reviewed ? "LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_REVIEWED_REPORT" : "LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_REPORT";
	const path = resolve(process.env[variable] ?? `build/php-wasm-fin-direct/${reviewed ? "reviewed" : "ordinary"}.json`);
	await saveLakeFile(dirname(path), path.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});

test("fresh PHP-Wasm direct Fin reviews reject tightened, loosened, omitted and changed source bounds before output", {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_LEAN_TEST !== "1"
	, timeout: 900000
}, async t => {
	const selected = await fixtures(t), extension = "lean-lang.org/refinements";
	const mirror = ir => ir.declarations.find(item => item.name === "mirror").source.extensions[extension];
	const emptyList = ir => ir.declarations.find(item => item.name === "emptyList").source.extensions[extension];
	const cases = [
		["tightened scalar", "scalar", ir => { mirror(ir).parameters[0].bound = "9"; }]
		, ["loosened scalar", "scalar", ir => { mirror(ir).parameters[0].bound = "11"; }]
		, ["omitted scalar", "scalar", ir => { mirror(ir).parameters[0] = null; }]
		, ["loosened Fin 0 list", "containers", ir => { emptyList(ir).parameters[0].arguments[0].bound = "1"; }]
		, ["omitted Fin 0 list", "containers", ir => { emptyList(ir).parameters[0] = null; }]
		, ["changed Lean source", "containers", () => {}]
	];
	for(const [label, name, change] of cases) await t.test(label, async () => {
		const fixture = selected[name], directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-direct-review-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "out");
		await cp(fixture.root, projectRoot, { recursive: true });
		const review = fixture.review(); change(review);
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: [fixture.module], targets: { "php-wasm": fixture.settings } }));
		if(label === "changed Lean source")
		{
			const source = await readFile(join(projectRoot, "FinContainers.lean"), "utf8");
			assert.ok(source.includes("abbrev Digit := Fin 10"));
			await saveLakeFile(projectRoot, "FinContainers.lean", source.replace("abbrev Digit := Fin 10", "abbrev Digit := Fin 11"));
		}
		await assert.rejects(() => buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment: nativeFixtureEnvironment(["php-wasm"]) }), error => {
			assert.equal(error.code, "reviewed-ir-source-mismatch", label);
			assert.match(error.details.field, /lean-lang\.org\/(?:nominal-)?refinements/u);
			return true;
		});
		await assert.rejects(access(outputRoot), { code: "ENOENT" });
	});
});
