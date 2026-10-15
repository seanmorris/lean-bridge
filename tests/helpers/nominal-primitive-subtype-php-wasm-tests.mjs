/**
 * Source-only controls for primitive-base nominal PHP-Wasm packages.
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
import {
	nominalPrimitiveSubtypeConfiguration
	, nominalPrimitiveSubtypeFields
} from "./nominal-primitive-subtype-fixture.mjs";
import {
	nominalPrimitiveSubtypePhpCaller
	, nominalPrimitiveSubtypePhpCounts
} from "./nominal-primitive-subtype-php-fixture.mjs";
import {
	adaptNominalPrimitiveSubtypePhpWasm
	, checkNominalPrimitiveSubtypePhpWasmExecutions
	, checkNominalPrimitiveSubtypePhpWasmModel
	, nominalPrimitiveSubtypePhpWasmCaller
	, nominalPrimitiveSubtypePhpWasmConfiguration
	, nominalPrimitiveSubtypePhpWasmExpected
	, nominalPrimitiveSubtypePhpWasmModes
	, nominalPrimitiveSubtypePhpWasmRequest
	, nominalPrimitiveSubtypePhpWasmReview
	, nominalPrimitiveSubtypePhpWasmRoutes
	, nominalPrimitiveSubtypePhpWasmSelection
	, nominalPrimitiveSubtypePhpWasmSettings
} from "./nominal-primitive-subtype-php-wasm-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("primitive-base nominal PHP-Wasm selections require explicit installed work", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_WASM_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalPrimitiveSubtypePhpWasmSelection({}), {
		enabled: false
		, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"]
	});
	assert.equal(nominalPrimitiveSubtypePhpWasmSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nominalPrimitiveSubtypePhpWasmSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", valid + ",", valid + "," + valid, true, null])
			assert.throws(() => nominalPrimitiveSubtypePhpWasmSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypePhpWasmSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalPrimitiveSubtypePhpWasmSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const name of ["OUTPUT", "MAX_LOAD"])
		assert.throws(() => nominalPrimitiveSubtypePhpWasmSelection({ [prefix + name]: "explicit" }));
});

test("primitive-base nominal PHP-Wasm preserves all nineteen reviewed bases", () => {
	for(const route of nominalPrimitiveSubtypePhpWasmRoutes) for(const mode of nominalPrimitiveSubtypePhpWasmModes)
	{
		const configuration = nominalPrimitiveSubtypePhpWasmConfiguration(route, mode);
		validateExportConfiguration(configuration);
		assert.deepEqual(configuration, {
			...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
			, targets: { "php-wasm": nominalPrimitiveSubtypePhpWasmSettings }
		});
		const review = nominalPrimitiveSubtypePhpWasmReview(mode); validateBindingIr(review);
			assert.equal(review.declarations.length, mode === "full" ? 14 : 6);
			const fields = review.types.find(type => type.name === "Packet").fields.map(field => field.name);
			assert.deepEqual(fields, [...nominalPrimitiveSubtypeFields.map(field => field.name), "digit"]);
			assert.deepEqual(nominalPrimitiveSubtypePhpWasmExpected(mode), {
				...nominalPrimitiveSubtypePhpCounts[mode], wordBits: 32
				, word_bits: 32, php: "8.4.1"
			});
	}
	for(const invalid of [undefined, "", "unknown", false])
	{
		assert.throws(() => nominalPrimitiveSubtypePhpWasmConfiguration(invalid, "full"));
		assert.throws(() => nominalPrimitiveSubtypePhpWasmConfiguration("ordinary", invalid));
		assert.throws(() => nominalPrimitiveSubtypePhpWasmReview(invalid));
		assert.throws(() => nominalPrimitiveSubtypePhpWasmExpected(invalid));
	}
});

test("primitive-base nominal PHP-Wasm caller changes only 32-bit host representations and loading", async () => {
	for(const route of nominalPrimitiveSubtypePhpWasmRoutes)
	for(const mode of nominalPrimitiveSubtypePhpWasmModes)
	for(const strictness of ["weak", "strict"])
	{
		const original = await nominalPrimitiveSubtypePhpCaller(route, mode);
		const source = await nominalPrimitiveSubtypePhpWasmCaller(route, mode, strictness);
		assert.equal(source, adaptNominalPrimitiveSubtypePhpWasm(original, strictness));
		assert.ok(source.includes("$call('word_bits', [], $n(32));"));
		assert.ok(source.includes("['uint32Value', $n('4294967294'), $n(0)]"));
		assert.ok(source.includes("['int64Value', $n('9223372036854775806'), $n('-9223372036854775808')]"));
		assert.ok(source.includes("['int32Value', 2147483646, PHP_INT_MIN]"));
		assert.ok(source.includes("['usizeValue', $n('4294967294'), $n(0)]"));
		assert.ok(source.includes("['isizeValue', 2147483646, PHP_INT_MIN]"));
		assert.ok(source.includes(`declare(strict_types=${strictness === "strict" ? 1 : 0});`));
		assert.equal(source.includes("require 'vendor/autoload.php'"), false);
		assert.equal(source.includes("$_SERVER['SCRIPT_FILENAME']"), false);
		assert.equal((source.match(/'wordBits' => 32/gu) ?? []).length, 2);
		assert.equal((source.match(/'word_bits' => PHP_INT_SIZE \* 8/gu) ?? []).length, 1);
	}
	const original = await nominalPrimitiveSubtypePhpCaller("ordinary", "full");
	for(const changed of [original + "unknown", original + original
		, original.replace("$call('word_bits', [], 64);", "$call('word_bits', [], 63);")
		, original.replace("['usizeValue', $n('18446744073709551614'), $n(0)]", "['usizeValue', $n(4), $n(0)]")])
		assert.throws(() => adaptNominalPrimitiveSubtypePhpWasm(changed, "weak"));
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("primitive-base nominal PHP-Wasm callers parse in weak and strict modes", {
	skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP for syntax checks"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-php-wasm-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of nominalPrimitiveSubtypePhpWasmRoutes)
	for(const mode of nominalPrimitiveSubtypePhpWasmModes)
	for(const strictness of ["weak", "strict"])
	{
		const file = `${route}-${mode}-${strictness}.php`;
		await saveLakeFile(root, file, await nominalPrimitiveSubtypePhpWasmCaller(route, mode, strictness));
		const run = await runCopied(php, ["-n", "-l", join(root, file)], root);
		assert.equal(run.stderr, ""); assert.ok(run.stdout.startsWith("No syntax errors detected in "));
	}
});

test("primitive-base nominal PHP-Wasm lazy probes name real selected exports", () => {
	for(const mode of nominalPrimitiveSubtypePhpWasmModes) for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(nominalPrimitiveSubtypePhpWasmRequest(mode, arrangement));
		assert.deepEqual(request, {
			module: "LeanNominalprimitivesubtypes"
			, operations: { probe: mode === "full" ? "echo_a" : "produce" }
			, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-nominalprimitivesubtypes/wasm/bootstrap.php"
		});
		const declaration = nominalPrimitiveSubtypePhpWasmReview(mode).declarations
			.find(item => item.id === `lean:NominalPrimitiveSubtypes.${mode === "full" ? "echoA" : "produce"}`);
		assert.ok(declaration);
	}
	for(const invalid of [undefined, "", "bundled", true])
	{
		assert.throws(() => nominalPrimitiveSubtypePhpWasmRequest("full", invalid));
		assert.throws(() => nominalPrimitiveSubtypePhpWasmRequest(invalid, "embedded"));
	}
});

test("primitive-base nominal PHP-Wasm models reject native width and changed refinement trees", async t => {
	let controls = 0;
	for(const route of nominalPrimitiveSubtypePhpWasmRoutes) for(const mode of nominalPrimitiveSubtypePhpWasmModes)
	{
		const native = JSON.parse(await readFile(`docs/evidence/nominal-primitive-subtype-php-20261015/${route}-${mode}/records/build-0/model.json`));
		assert.throws(() => checkNominalPrimitiveSubtypePhpWasmModel(native, route, mode)); controls++;
		const model = structuredClone(native);
		model.profile = "php-wasm-copied-v1"; model.pointerBits = 32;
		checkNominalPrimitiveSubtypePhpWasmModel(model, route, mode);
		const changes = [item => { item.profile = "native-library-v1"; }
			, item => { item.pointerBits = 64; }
			, item => { item.byteOrder = "big"; }
			, item => { item.schemaVersion = route === "reviewed" ? 2 : 3; }
			, item => { item.exports.pop(); }
			, item => { item.exports.push(item.exports[0]); }
			, item => { item.exports[0].name = "NominalPrimitiveSubtypes.unknown"; }
			, item => { item.bindingIr.types.find(type => type.name === "Packet").fields[1].type = { kind: "primitive", name: "uint64" }; }
			, item => { item.exports.find(exp => exp.name.endsWith(".produce")).refinements.result.arguments[0].fields[0] = "invented"; }];
		if(mode === "full") changes.push(item => {
			item.exports.find(exp => exp.name.endsWith(".echoA")).refinements.parameters[0].arguments[1].constructor = "NominalPrimitiveSubtypes.boolB";
		});
		for(const mutate of changes)
		{
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => checkNominalPrimitiveSubtypePhpWasmModel(changed, route, mode)); controls++;
		}
	}
	assert.equal(controls, 42);
	t.diagnostic(`${controls} native-width, source-route and refinement substitutions refused`);
});

test("primitive-base nominal PHP-Wasm observations require every host context and phase", t => {
	let controls = 0;
	for(const mode of nominalPrimitiveSubtypePhpWasmModes)
	{
		const libraries = ["component.so", "runtime.so"];
		const evidence = {
			component: { pointerBits: 32, library: libraries[0] }
			, runtime: { pointerBits: 32, library: libraries[1] }
			, executions: phpWasmExecutionTuples.map(tuple => {
				const [realm, arrangement, loading, strictness] = tuple.split("/");
					return { realm, arrangement, loading, mode: strictness
						, observation: nominalPrimitiveSubtypePhpWasmExpected(mode)
						, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({
							stage
							, libraries: loading === "startup" || stage === "complete" ? [...libraries] : []
						}))
					};
			})
		};
		checkNominalPrimitiveSubtypePhpWasmExecutions(evidence, mode);
		for(const index of evidence.executions.keys()) for(const mutate of [
			item => { item.executions.splice(index, 1); }
			, item => { item.executions.push(item.executions[index]); }
			, item => { item.executions[index].realm = "firefox"; }
			, item => { item.executions[index].phases.pop(); }
			, item => { item.executions[index].observation.wordBits = 64; }
			, item => { item.executions[index].observation.word_bits = 64; }
		]){
			const changed = structuredClone(evidence); mutate(changed);
			assert.throws(() => checkNominalPrimitiveSubtypePhpWasmExecutions(changed, mode)); controls++;
		}
		for(const key of ["component", "runtime"])
		{
			const changed = structuredClone(evidence); changed[key].pointerBits = 64;
			assert.throws(() => checkNominalPrimitiveSubtypePhpWasmExecutions(changed, mode)); controls++;
		}
		const same = structuredClone(evidence); same.runtime.library = same.component.library;
		assert.throws(() => checkNominalPrimitiveSubtypePhpWasmExecutions(same, mode)); controls++;
	}
	assert.equal(controls, 150);
	t.diagnostic(`${controls} missing, duplicated, changed-width or changed-phase observations refused`);
});
