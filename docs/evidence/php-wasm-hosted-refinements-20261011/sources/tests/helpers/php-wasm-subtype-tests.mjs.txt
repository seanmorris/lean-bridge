/**
 * Checked primitive Subtype construction through the plain copied wasm32 PHP path.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { generateNativePrimitiveC } from "../../src/backends/c/native-primitives.mjs";
import { createPhpWasmCopiedModel, generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { buildElaboratedComponent } from "../../src/build/elaborated-component.mjs";
import { phpWasmFinReadme } from "../../src/release/php-wasm-copied-package.mjs";
import { checkInstalledPhpWasmFixture, phpWasmFinCaller } from "./php-wasm-fin-fixtures.mjs";
import { phpWasmSubtypeFixture, phpWasmSubtypeRefinements, phpWasmSubtypeReview } from "./php-wasm-subtype-fixture.mjs";
import { reviewedSubtypeInstalledSource } from "./reviewed-subtype-installed-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const leanEnabled = process.env.LEAN_BRIDGE_PHP_WASM_SUBTYPE_LEAN_TEST === "1";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const settings = { integerBits: 32, structuredCallables: true, lists: true, variants: true };

test("PHP-Wasm Subtype fixtures preserve the native corpus and independently chosen constructors", async t => {
	const fixture = await phpWasmSubtypeFixture(t), review = fixture.review();
	validateBindingIr(review); compileCopiedPhpModel(review, settings);
	const readme = phpWasmFinReadme(compileCopiedPhpModel(review, settings));
	assert.match(readme, /PHP-Wasm side module runs the author's checked constructor/u);
	assert.doesNotMatch(readme, /Subtype inside[^\n]*reviewed Binding IR/u);
	validateExportConfiguration({ schemaVersion: 1, modules: [fixture.module]
		, exports: fixture.exports, contracts: fixture.contracts
		, specializations: fixture.specializations
		, targets: { "php-wasm": fixture.settings } });
	assert.equal(review.declarations.length, 12);
	const expected = Object.fromEntries(review.declarations.map(item => [
		item.source.extensions["lean-lang.org/specialization"]?.name ?? item.source.declaration
		, item.source.extensions["lean-lang.org/refinements"]
	]));
	assert.deepEqual(expected, fixture.refinements);
	assert.notEqual(expected["Subtypes.firstEven"].parameters[0].constructor, expected["Subtypes.secondEven"].parameters[0].constructor);
	assert.deepEqual(expected["Subtypes.zeroEven"].parameters, []);
	const original = await readFile("tests/fixtures/subtype-consumers/php-native.php", "utf8");
	const source = await readFile(fixture.consumer, "utf8"), marker = "$checks += 2000;\n";
	const [before, after] = original.split(marker);
	assert.ok(source.startsWith(before) && source.endsWith(marker + after));
	assert.equal((source.match(/^check\(/gmu) ?? []).length, (original.match(/^check\(/gmu) ?? []).length + 8);
	assert.equal(await readFile(join(fixture.root, "Subtypes.lean"), "utf8"), await readFile("tests/fixtures/onboarding/native-subtype/Subtypes.lean", "utf8") + reviewedSubtypeInstalledSource);
	const caller = await phpWasmFinCaller(fixture);
	for(const mode of ["weak", "strict"])
	{
		assert.ok(caller.source(mode).includes(`declare(strict_types=${mode === "strict" ? 1 : 0});`));
		assert.ok(caller.source(mode).includes("$checks += 2000;"));
		assert.ok(!caller.source(mode).includes("require 'vendor/autoload.php';"));
	}
});

/**
 * Compile the selected Lean source and adapters, stopping before C compilation or publication.
 *
 * @param t - Test context owning all source and compiler staging.
 * @param reviewed - Whether the independent review owns the selection.
 * @param mutate - Optional exact mutation of the review or ordinary configuration.
 */
const elaborate = async (t, reviewed, mutate = () => {}) => {
	const fixture = await phpWasmSubtypeFixture(t);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-subtype-lean-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "out");
	await cp(fixture.root, projectRoot, { recursive: true });
	const configuration = { schemaVersion: 1, modules: [fixture.module]
		, targets: { "php-wasm": fixture.settings }
		, ...reviewed ? {} : { exports: fixture.exports, contracts: structuredClone(fixture.contracts), specializations: fixture.specializations } };
	const review = fixture.review(); mutate(reviewed ? review : configuration);
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
	if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
	let result;
	const stopped = new Error("PHP-Wasm Subtype adapters compiled; stop before C");
	const compileComponent = async ({ model, adapters, generatedC }) => {
		result = { model, adapters, c: await readFile(generatedC, "utf8") };
		throw stopped;
	};
	try
	{
		const options = { projectRoot, outputRoot, leanPrefix
			, targets: ["php-wasm"], profile: "php-wasm-copied-v1"
			, receiptName: "php-wasm-component.json"
			, createModel: createPhpWasmCopiedModel
			, createAdapters: generateNativeLeanAdapters, compileComponent };
		await assert.rejects(() => buildElaboratedComponent(options)
			, error => { if(error !== stopped) throw error; return true; });
	}
	finally
	{ await assert.rejects(access(outputRoot), { code: "ENOENT" }); }
	assert.ok(result);
	return result;
};

for(const reviewed of [false, true]) test(`${reviewed ? "reviewed" : "ordinary"} PHP-Wasm Subtype adapters compile with fresh Lean and retain every checked site`, {
	skip: !leanEnabled, timeout: 600000
}, async t => {
	const { model, adapters, c } = await elaborate(t, reviewed);
	assert.equal(model.pointerBits, 32); assert.equal(model.schemaVersion, reviewed ? 3 : 2);
	assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), phpWasmSubtypeRefinements);
	assert.ok(c.includes("#include \"component.h\""));
	assert.ok(adapters.leanSource.includes("_root_.Subtypes.normalizedEven"));
	const provider = generateNativePrimitiveC(model, { initializer: `initialize_${adapters.module}` });
	for(const item of model.exports) item.refinements.parameters.forEach((refinement, index) => {
		if(refinement?.kind !== "subtype") return;
		assert.ok(provider.includes(`${item.symbol}_refinement_${index}(`));
		assert.ok(provider.includes(`arg${index} was rejected by ${refinement.constructor}`));
		assert.ok(adapters.leanSource.includes(`@[export ${item.symbol}_refinement_${index}]`));
	});
});

test("a different valid reviewed Subtype constructor remains a legitimate PHP-Wasm API choice", {
	skip: !leanEnabled, timeout: 600000
}, async t => {
	const { model } = await elaborate(t, true, review => {
		review.declarations.find(item => item.name === "half").source.extensions["lean-lang.org/refinements"].parameters[0].constructor = "Subtypes.normalizedEven";
	});
	assert.equal(model.exports.find(item => item.name === "Subtypes.half").refinements.parameters[0].constructor, "Subtypes.normalizedEven");
});

test("fresh PHP-Wasm Subtype analysis refuses invalid constructors and incompatible reviewed transports before output", {
	skip: !leanEnabled, timeout: 900000
}, async t => {
	const key = "lean-lang.org/refinements";
	const half = review => review.declarations.find(item => item.name === "half");
	const cases = [
		["wrong input base", review => { half(review).source.extensions[key].parameters[0].constructor = "Subtypes.checkedWord"; }, /input must equal the subtype base/u]
		, ["wrong output subtype", review => { half(review).source.extensions[key].parameters[0].constructor = "Subtypes.wrongEven"; }, /return Option of the exact subtype/u]
		, ["unsafe constructor", review => { half(review).source.extensions[key].parameters[0].constructor = "Subtypes.unsafeEven"; }, /unsafe, partial or foreign implementation contract/u]
		, ["partial constructor", review => { half(review).source.extensions[key].parameters[0].constructor = "Subtypes.partialEven"; }, /unsafe, partial or foreign implementation contract/u]
		, ["outside source closure", review => { half(review).source.extensions[key].parameters[0].constructor = "Option.some"; }, /must belong to a selected module/u]
		, ["missing constructor", review => { delete half(review).source.extensions[key]; }, /require a configured checked constructor/u]
		, ["wrong Fin bound", review => { review.declarations.find(item => item.name === "mix").source.extensions[key].parameters[1].bound = "11"; }, /reviewed-ir-source-mismatch/u]
		, ["wrong transport", review => { half(review).parameters[0].type.name = "int"; }, /reviewed-ir-source-mismatch/u]
	];
	for(const [name, mutate, pattern] of cases) await t.test(name, async () => {
		await assert.rejects(() => elaborate(t, true, mutate), error => {
			assert.match(JSON.stringify({ code: error.code, message: error.message, details: error.details }), pattern, name);
			return true;
		});
	});
});

for(const reviewed of [false, true]) test(`${reviewed ? "reviewed" : "ordinary"} installed PHP-Wasm Subtypes execute all checked constructors and recover after rejection`, {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_SUBTYPE_TEST !== "1", timeout: 3600000
}, async t => {
	const fixture = await phpWasmSubtypeFixture(t);
	const verifyModel = model => assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), phpWasmSubtypeRefinements);
	const { readme, report } = await checkInstalledPhpWasmFixture(t, { ...fixture, label: "subtypes", reviewed, verifyModel, minimumChecks: 2000 });
	assert.match(readme, /Subtype parameters cross as their base value/u);
	assert.match(readme, /PHP-Wasm side module runs the author's checked constructor/u);
	assert.doesNotMatch(readme, /Subtype inside[^\n]*reviewed Binding IR/u);
	const original = await readFile(fixture.consumer, "utf8");
	const checks = 2000 + (original.match(/^check\(/gmu) ?? []).length;
	for(const execution of report.phpWasm.executions) assert.equal(execution.observation.checks, checks);
	const path = resolve(process.env[reviewed ? "LEAN_BRIDGE_PHP_WASM_SUBTYPE_REVIEWED_REPORT" : "LEAN_BRIDGE_PHP_WASM_SUBTYPE_REPORT"] ?? `build/php-wasm-subtype/${reviewed ? "reviewed" : "ordinary"}.json`);
	const fixtureSources = { leanSha256: sha256(await readFile(join(fixture.root, "Subtypes.lean"))), phpSha256: sha256(original) };
	await saveLakeFile(dirname(path), path.split("/").at(-1), canonicalJson({
		schemaVersion: 1, fixture: "subtypes", fixtureSources
		, refinements: phpWasmSubtypeRefinements
		, constructorDispatch: "not measured", ...report
	}));
});

test("independent PHP-Wasm Subtype review does not borrow the ordinary configuration", () => {
	const review = phpWasmSubtypeReview();
	assert.equal(review.declarations.find(item => item.name === "secondEven").source.extensions["lean-lang.org/refinements"].parameters[0].constructor, "Subtypes.normalizedEven");
	review.declarations.find(item => item.name === "secondEven").source.extensions["lean-lang.org/refinements"].parameters[0].constructor = "Subtypes.checkedEven";
	assert.equal(phpWasmSubtypeRefinements["Subtypes.secondEven"].parameters[0].constructor, "Subtypes.normalizedEven");
	assert.equal(phpWasmSubtypeReview().declarations.find(item => item.name === "secondEven").source.extensions["lean-lang.org/refinements"].parameters[0].constructor, "Subtypes.normalizedEven");
});
