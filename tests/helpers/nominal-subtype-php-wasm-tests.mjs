/**
 * Check nominal PHP-Wasm selections and adapters without claiming installed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { nominalSubtypePhpRoutes, nominalSubtypePhpModes, nominalSubtypePhpCounts, nominalSubtypePhpConfiguration, nominalSubtypePhpReview, nominalSubtypePhpCaller } from "./nominal-subtype-php-fixture.mjs";
import { nominalSubtypePhpWasmSettings, nominalSubtypePhpWasmSelection, nominalSubtypePhpWasmConfiguration, nominalSubtypePhpWasmExpected, adaptNominalSubtypePhpWasm, nominalSubtypePhpWasmCaller, nominalSubtypePhpWasmRequest, checkNominalSubtypePhpWasmModel, checkNominalSubtypePhpWasmExecutions } from "./nominal-subtype-php-wasm-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import "./nominal-subtype-php-wasm-evidence-tests.mjs";

test("nominal PHP-Wasm selections refuse disabled explicit work, malformed flags and duplicate selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalSubtypePhpWasmSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalSubtypePhpWasmSelection(enabled).enabled, true);
	assert.equal(nominalSubtypePhpWasmSelection({ [prefix + "TEST"]: "0" }).enabled, false);
	for(const value of ["", "true", "yes", "2", true, null]) assert.throws(() => nominalSubtypePhpWasmSelection({ [prefix + "TEST"]: value }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => nominalSubtypePhpWasmSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalSubtypePhpWasmSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalSubtypePhpWasmSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const flag of [undefined, "0"])
		assert.throws(() => nominalSubtypePhpWasmSelection({ [prefix + "TEST"]: flag, [prefix + "OUTPUT"]: "explicit" }));
	for(const value of ["", true, null])
		assert.throws(() => nominalSubtypePhpWasmSelection({ ...enabled, [prefix + "OUTPUT"]: value }));
	assert.equal(nominalSubtypePhpWasmSelection({ ...enabled, [prefix + "OUTPUT"]: "build/explicit" }).enabled, true);
});

test("nominal PHP-Wasm preserves the complete native author contracts and constructor-free result selection", () => {
	for(const route of nominalSubtypePhpRoutes) for(const mode of nominalSubtypePhpModes)
	{
		const native = nominalSubtypePhpConfiguration(route, mode), actual = nominalSubtypePhpWasmConfiguration(route, mode);
		validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: native.targets }, native);
		assert.deepEqual(actual.targets, { "php-wasm": nominalSubtypePhpWasmSettings });
		const expected = nominalSubtypePhpReview(mode); validateBindingIr(expected);
		assert.equal(expected.declarations.length, mode === "full" ? 26 : 13);
		if(route === "reviewed" || mode === "result-only") assert.equal(actual.contracts, undefined);
		for(const declaration of expected.declarations)
			assert.doesNotMatch(JSON.stringify(declaration.source.extensions["lean-lang.org/refinements"].result), /plusOne|plusTwo/u);
		assert.deepEqual(nominalSubtypePhpWasmExpected(mode), { ...nominalSubtypePhpCounts[mode], word_bits: 32, php: "8.4.1" });
	}
	for(const invalid of [undefined, "", "unknown", false])
	{
		assert.throws(() => nominalSubtypePhpWasmConfiguration(invalid, "full"));
		assert.throws(() => nominalSubtypePhpWasmConfiguration("ordinary", invalid));
		assert.throws(() => nominalSubtypePhpWasmExpected(invalid));
	}
});

test("nominal PHP-Wasm caller adaptation preserves every assertion and rejects unexpected entry layouts", async () => {
	for(const route of nominalSubtypePhpRoutes) for(const mode of nominalSubtypePhpModes) for(const strictness of ["weak", "strict"])
	{
		const original = await nominalSubtypePhpCaller(route, mode);
		const source = await nominalSubtypePhpWasmCaller(route, mode, strictness);
		assert.equal(source, adaptNominalSubtypePhpWasm(original, strictness));
		const restored = source.replace(`declare(strict_types=${strictness === "strict" ? 1 : 0});`, "declare(strict_types=0);")
			.replace("    $api = [];\n", "if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {\n    require 'vendor/autoload.php';\n    $api = [];\n")
			.replace('    $observed = check_nominal_subtypes($api, NOMINAL_RESULT_ONLY);\n'
				+ '    echo json_encode([...$observed, \'word_bits\' => PHP_INT_SIZE * 8, \'php\' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\\n";\n',
			'    echo json_encode(check_nominal_subtypes($api, NOMINAL_RESULT_ONLY), JSON_THROW_ON_ERROR) . "\\n";\n}\n');
		assert.equal(restored, original);
		assert.equal(source.includes("require 'vendor/autoload.php'"), false);
		assert.equal(source.includes("$_SERVER['SCRIPT_FILENAME']"), false);
		for(const changed of [original + "unknown", original + original
			, original.replace("declare(strict_types=0);", "declare(strict_types=1);")
			, original.replace("require 'vendor/autoload.php';", "require 'author/autoload.php';")
			, original.replace("echo json_encode(check_nominal_subtypes", "echo json_encode(shortened_corpus")])
			assert.throws(() => adaptNominalSubtypePhpWasm(changed, strictness));
	}
	for(const invalid of [undefined, "", "unknown", true])
		await assert.rejects(nominalSubtypePhpWasmCaller("ordinary", "full", invalid));
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("nominal PHP-Wasm adapted callers parse in both lexical strictness modes", {
	skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP for caller syntax checks"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-php-wasm-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of nominalSubtypePhpRoutes) for(const mode of nominalSubtypePhpModes) for(const strictness of ["weak", "strict"])
	{
		const file = `${route}-${mode}-${strictness}.php`;
		await saveLakeFile(root, file, await nominalSubtypePhpWasmCaller(route, mode, strictness));
		const run = await runCopied(php, ["-n", "-l", join(root, file)], root);
		assert.equal(run.stderr, ""); assert.ok(run.stdout.startsWith("No syntax errors detected in "));
	}
});

test("nominal PHP-Wasm lazy probes use selected public exports without fabricating result constructors", () => {
	for(const mode of nominalSubtypePhpModes) for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(nominalSubtypePhpWasmRequest(mode, arrangement));
		assert.deepEqual(request, { module: "LeanNominalsubtypes"
			, operations: { probe: mode === "full" ? "first" : "scalar" }
			, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-nominalsubtypes/wasm/bootstrap.php" });
		const declaration = nominalSubtypePhpReview(mode).declarations.find(item => item.source.declaration === `NominalSubtypes.${request.operations.probe}`);
		assert.ok(declaration);
		if(mode === "result-only") assert.deepEqual(declaration.source.extensions["lean-lang.org/refinements"].parameters, [null]);
	}
	for(const invalid of [undefined, "", "bundled", true])
	{
		assert.throws(() => nominalSubtypePhpWasmRequest("full", invalid));
		assert.throws(() => nominalSubtypePhpWasmRequest(invalid, "embedded"));
	}
});

test("nominal PHP-Wasm model controls reject missing fields, changed constructors and native profiles", async t => {
	let controls = 0;
	for(const route of nominalSubtypePhpRoutes) for(const mode of nominalSubtypePhpModes)
	{
		const native = JSON.parse(await readFile(`docs/evidence/nominal-subtype-php-20261013/${route}-${mode}/records/build-0/model.json`));
		assert.throws(() => checkNominalSubtypePhpWasmModel(native, route, mode)); controls++;
		// Synthetic verifier control only. Changing these two fields does not establish Wasm execution.
		const model = { ...native, profile: "php-wasm-copied-v1", pointerBits: 32 };
		checkNominalSubtypePhpWasmModel(model, route, mode);
		const mutations = [item => { item.profile = "native-library-v1"; }
			, item => { item.pointerBits = 64; }, item => { item.byteOrder = "big"; }
			, item => { item.schemaVersion = route === "reviewed" ? 2 : 3; }
			, item => { item.exports.pop(); }
			, item => { item.exports.push(item.exports[0]); }
			, item => { item.exports[0].name = "NominalSubtypes.unknown"; }
			, item => { item.bindingIr.types.find(type => type.name === "Envelope").fields[0].type = { kind: "primitive", name: "uint64" }; }
			, item => { item.exports.find(exp => exp.name.endsWith(".produceEnvelope")).refinements.result.arguments[0].constructor = "NominalSubtypes.plusOne"; }
			, item => { item.exports.find(exp => exp.name.endsWith(".produceEnvelope")).refinements.result.arguments[1].bound = "4"; }];
		if(mode === "full") mutations.push(item => { item.exports.find(exp => exp.name.endsWith(".second")).refinements.parameters[0].arguments[0].constructor = "NominalSubtypes.plusOne"; });
		for(const mutate of mutations)
		{
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => checkNominalSubtypePhpWasmModel(changed, route, mode)); controls++;
		}
		const paths = [];
		const walk = (value, prefix) => {
			if(value === null || typeof value !== "object") return;
			for(const [key, child] of Object.entries(value))
			{ const path = [...prefix, key]; paths.push(path); walk(child, path); }
		};
		for(const [index, exp] of model.exports.entries()) walk(exp.refinements, ["exports", index, "refinements"]);
		for(const path of paths)
		{
			const changed = structuredClone(model);
			let parent = changed;
			for(const key of path.slice(0, -1)) parent = parent[key];
			delete parent[path.at(-1)];
			assert.throws(() => checkNominalSubtypePhpWasmModel(changed, route, mode), path.join(".")); controls++;
		}
	}
	assert.ok(controls > 1000);
	t.diagnostic(`${controls} synthetic model mutations refused; no installed Wasm execution claim`);
});

test("nominal PHP-Wasm observations require all twelve contexts and exact startup and lazy phases", t => {
	let controls = 0;
	for(const mode of nominalSubtypePhpModes)
	{
		const libraries = ["component.so", "runtime.so"];
		const evidence = { component: { pointerBits: 32, library: libraries[0] }
			, runtime: { pointerBits: 32, library: libraries[1] }
			, executions: phpWasmExecutionTuples.map(tuple => {
				const [realm, arrangement, loading, strictness] = tuple.split("/");
				return { realm, arrangement, loading, mode: strictness
					, observation: nominalSubtypePhpWasmExpected(mode)
					, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: loading === "startup" || stage === "complete" ? [...libraries] : [] })) };
			})
		};
		checkNominalSubtypePhpWasmExecutions(evidence, mode);
		for(const index of evidence.executions.keys())
		{
			const changes = [item => { item.executions.splice(index, 1); }
				, item => { item.executions.push(item.executions[index]); }
				, item => { item.executions[index].realm = "firefox"; }
				, item => { item.executions[index].loading = "unknown"; }
				, item => { item.executions[index].mode = "full"; }
				, item => { item.executions[index].phases.reverse(); }
				, item => { item.executions[index].phases.pop(); }
				, item => { item.executions[index].phases[2].libraries = item.executions[index].loading === "startup" ? [] : [...libraries]; }
				, item => { item.executions[index].phases[3].libraries.push(libraries[0]); }
				, item => { item.executions[index].phases[0].extra = true; }
				, item => { item.executions[index].observation.extra = true; }];
			for(const key of Object.keys(nominalSubtypePhpWasmExpected(mode)))
				changes.push(item => { item.executions[index].observation[key] = "wrong"; });
			for(const mutate of changes)
			{
				const changed = structuredClone(evidence); mutate(changed);
				assert.throws(() => checkNominalSubtypePhpWasmExecutions(changed, mode)); controls++;
			}
		}
		for(const key of ["component", "runtime"])
		{
			const changed = structuredClone(evidence); changed[key].pointerBits = 64;
			assert.throws(() => checkNominalSubtypePhpWasmExecutions(changed, mode)); controls++;
		}
		const changed = structuredClone(evidence); changed.runtime.library = changed.component.library;
		assert.throws(() => checkNominalSubtypePhpWasmExecutions(changed, mode)); controls++;
	}
	assert.equal(controls, 414);
	t.diagnostic(`${controls} synthetic missing, duplicate, changed or early-loading observations refused`);
});
