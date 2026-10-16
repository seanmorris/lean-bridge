/**
 * Source-only controls for nested checked-record PHP-Wasm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordPhpCaller
	, nestedCheckedRecordPhpCounts
} from "./nested-checked-record-php-fixture.mjs";
import {
	adaptNestedCheckedRecordPhpWasm
	, checkNestedCheckedRecordPhpWasmExecutions
	, checkNestedCheckedRecordPhpWasmModel
	, nestedCheckedRecordPhpWasmCaller
	, nestedCheckedRecordPhpWasmConfiguration
	, nestedCheckedRecordPhpWasmExpected
	, nestedCheckedRecordPhpWasmModes
	, nestedCheckedRecordPhpWasmRequest
	, nestedCheckedRecordPhpWasmReview
	, nestedCheckedRecordPhpWasmRoutes
	, nestedCheckedRecordPhpWasmSelection
	, nestedCheckedRecordPhpWasmSettings
} from "./nested-checked-record-php-wasm-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("nested checked-record PHP-Wasm selections require explicit installed work", () => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nestedCheckedRecordPhpWasmSelection({}), {
		enabled: false
		, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"]
	});
	assert.equal(nestedCheckedRecordPhpWasmSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nestedCheckedRecordPhpWasmSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", valid + ",", valid + "," + valid, true, null])
			assert.throws(() => nestedCheckedRecordPhpWasmSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nestedCheckedRecordPhpWasmSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nestedCheckedRecordPhpWasmSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const name of ["OUTPUT", "MAX_LOAD"])
		assert.throws(() => nestedCheckedRecordPhpWasmSelection({ [prefix + name]: "explicit" }));
});

test("nested checked-record PHP-Wasm preserves both author contracts and constructor-free results", () => {
	for(const route of nestedCheckedRecordPhpWasmRoutes) for(const mode of nestedCheckedRecordPhpWasmModes)
	{
		const configuration = nestedCheckedRecordPhpWasmConfiguration(route, mode);
		validateExportConfiguration(configuration);
		assert.deepEqual(configuration, {
			...nestedCheckedRecordConfiguration(route, ["c"], mode)
			, targets: { "php-wasm": nestedCheckedRecordPhpWasmSettings }
		});
		const review = nestedCheckedRecordPhpWasmReview(mode); validateBindingIr(review);
		assert.deepEqual(review, nestedCheckedRecordReview(mode));
		assert.equal(review.declarations.length, mode === "full" ? 13 : 2);
		assert.deepEqual(review.types.find(type => type.name === "Packet").fields.map(field => field.name), ["digit", "word"]);
		assert.deepEqual(nestedCheckedRecordPhpWasmExpected(mode), {
			...nestedCheckedRecordPhpCounts[mode], word_bits: 32, php: "8.4.1"
		});
	}
	for(const invalid of [undefined, "", "unknown", false])
	{
		assert.throws(() => nestedCheckedRecordPhpWasmConfiguration(invalid, "full"));
		assert.throws(() => nestedCheckedRecordPhpWasmConfiguration("ordinary", invalid));
		assert.throws(() => nestedCheckedRecordPhpWasmReview(invalid));
		assert.throws(() => nestedCheckedRecordPhpWasmExpected(invalid));
	}
});

test("nested checked-record PHP-Wasm caller changes only loading, strictness and host observations", async () => {
	for(const route of nestedCheckedRecordPhpWasmRoutes)
	for(const mode of nestedCheckedRecordPhpWasmModes)
	for(const strictness of ["weak", "strict"])
	{
		const original = await nestedCheckedRecordPhpCaller(route, mode);
		const source = await nestedCheckedRecordPhpWasmCaller(route, mode, strictness);
		assert.equal(source, adaptNestedCheckedRecordPhpWasm(original, strictness));
		assert.ok(source.includes(`declare(strict_types=${strictness === "strict" ? 1 : 0});`));
		assert.equal(source.includes("require 'vendor/autoload.php'"), false);
		assert.equal(source.includes("$_SERVER['SCRIPT_FILENAME']"), false);
		assert.equal((source.match(/'word_bits' => PHP_INT_SIZE \* 8/gu) ?? []).length, 1);
		// Everything between the declaration and the entry point is the unchanged native caller.
		const body = original.slice(original.indexOf("\n", original.indexOf("declare(")), original.indexOf("if (realpath("));
		assert.ok(source.includes(body));
	}
	const original = await nestedCheckedRecordPhpCaller("ordinary", "full");
	for(const changed of [original + "unknown", original + original
		, original.replace("declare(strict_types=0);", "declare(strict_types=1);")
		, original.replace("    require 'vendor/autoload.php';\n", "")])
		assert.throws(() => adaptNestedCheckedRecordPhpWasm(changed, "weak"));
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("nested checked-record PHP-Wasm callers parse in weak and strict modes", {
	skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP for syntax checks"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-php-wasm-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of nestedCheckedRecordPhpWasmRoutes)
	for(const mode of nestedCheckedRecordPhpWasmModes)
	for(const strictness of ["weak", "strict"])
	{
		const file = `${route}-${mode}-${strictness}.php`;
		await saveLakeFile(root, file, await nestedCheckedRecordPhpWasmCaller(route, mode, strictness));
		const run = await runCopied(php, ["-n", "-l", join(root, file)], root);
		assert.equal(run.stderr, ""); assert.ok(run.stdout.startsWith("No syntax errors detected in "));
	}
});

test("nested checked-record PHP-Wasm lazy probes name real selected exports", () => {
	for(const mode of nestedCheckedRecordPhpWasmModes) for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(nestedCheckedRecordPhpWasmRequest(mode, arrangement));
		assert.deepEqual(request, {
			module: "LeanNestedcheckedrecords"
			, operations: { probe: mode === "full" ? "first" : "produce_option" }
			, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-nestedcheckedrecords/wasm/bootstrap.php"
		});
		const declaration = nestedCheckedRecordPhpWasmReview(mode).declarations
			.find(item => item.id === `lean:NestedCheckedRecords.${mode === "full" ? "first" : "produceOption"}`);
		assert.ok(declaration);
	}
	for(const invalid of [undefined, "", "bundled", true])
	{
		assert.throws(() => nestedCheckedRecordPhpWasmRequest("full", invalid));
		assert.throws(() => nestedCheckedRecordPhpWasmRequest(invalid, "embedded"));
	}
});

test("nested checked-record PHP-Wasm models reject native width and changed refinement trees", t => {
	const project = tree => {
		if(tree === null || ["fin", "subtype"].includes(tree.kind)) return tree;
		const named = fields => ({
			fields: fields.map(field => field.name)
			, arguments: fields.map(field => project(field.refinement))
		});
		if(tree.kind === "checked-record")
			return { kind: tree.kind, definition: tree.name, constructor: tree.constructor, ...named(tree.fields) };
		if(tree.kind === "record") return { kind: tree.kind, definition: tree.name, ...named(tree.fields) };
		if(tree.kind === "variant")
			return { kind: tree.kind, definition: tree.name, cases: tree.cases.map(branch => ({ name: branch.name, ...named(branch.fields) })) };
		return { kind: tree.kind, arguments: tree.arguments.map(project) };
	};
	const exported = declaration => {
		const trees = declaration.source.extensions["lean-lang.org/refinements"];
		const refinements = { parameters: trees.parameters.map(project), result: project(trees.result) };
		return { name: declaration.id.slice(5), refinements };
	};
	let controls = 0;
	for(const route of nestedCheckedRecordPhpWasmRoutes) for(const mode of nestedCheckedRecordPhpWasmModes)
	{
		// Synthetic wasm32 models from the independent review; installed compiler models are checked by the harness.
		const review = nestedCheckedRecordPhpWasmReview(mode);
		const model = {
			profile: "php-wasm-copied-v1", pointerBits: 32, byteOrder: "little"
			, schemaVersion: route === "reviewed" ? 3 : 2, bindingIr: review
			, exports: review.declarations.map(exported)
		};
		checkNestedCheckedRecordPhpWasmModel(model, route, mode);
		const result = item => item.exports.find(exp => exp.name.endsWith(".produceOption")).refinements.result.arguments[0];
		const changes = [item => { item.profile = "native-library-v1"; }
			, item => { item.pointerBits = 64; }
			, item => { item.byteOrder = "big"; }
			, item => { item.schemaVersion = route === "reviewed" ? 2 : 3; }
			, item => { item.exports.pop(); }
			, item => { item.exports.push(item.exports[0]); }
			, item => { item.exports[0].name = "NestedCheckedRecords.unknown"; }
			, item => { result(item).fields[0] = "invented"; }
			, item => { result(item).constructor = "NestedCheckedRecords.mkPacket"; }];
		if(mode === "full") changes.push(item => {
			item.exports.find(exp => exp.name.endsWith(".first")).refinements.parameters[0].arguments[1].constructor = "NestedCheckedRecords.normalizeWord";
		});
		for(const mutate of changes)
		{
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => checkNestedCheckedRecordPhpWasmModel(changed, route, mode)); controls++;
		}
	}
	assert.equal(controls, 38);
	t.diagnostic(`${controls} native-width, source-route and refinement substitutions refused`);
});

test("nested checked-record PHP-Wasm observations require every host context and phase", t => {
	let controls = 0;
	for(const mode of nestedCheckedRecordPhpWasmModes)
	{
		const libraries = ["component.so", "runtime.so"];
		const evidence = {
			component: { pointerBits: 32, library: libraries[0] }
			, runtime: { pointerBits: 32, library: libraries[1] }
			, executions: phpWasmExecutionTuples.map(tuple => {
				const [realm, arrangement, loading, strictness] = tuple.split("/");
					return { realm, arrangement, loading, mode: strictness
						, observation: nestedCheckedRecordPhpWasmExpected(mode)
						, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({
							stage
							, libraries: loading === "startup" || stage === "complete" ? [...libraries] : []
						}))
					};
			})
		};
		checkNestedCheckedRecordPhpWasmExecutions(evidence, mode);
		for(const index of evidence.executions.keys()) for(const mutate of [
			item => { item.executions.splice(index, 1); }
			, item => { item.executions.push(item.executions[index]); }
			, item => { item.executions[index].realm = "firefox"; }
			, item => { item.executions[index].phases.pop(); }
			, item => { item.executions[index].observation.recoveries++; }
			, item => { item.executions[index].observation.word_bits = 64; }
		]){
			const changed = structuredClone(evidence); mutate(changed);
			assert.throws(() => checkNestedCheckedRecordPhpWasmExecutions(changed, mode)); controls++;
		}
		for(const key of ["component", "runtime"])
		{
			const changed = structuredClone(evidence); changed[key].pointerBits = 64;
			assert.throws(() => checkNestedCheckedRecordPhpWasmExecutions(changed, mode)); controls++;
		}
		const same = structuredClone(evidence); same.runtime.library = same.component.library;
		assert.throws(() => checkNestedCheckedRecordPhpWasmExecutions(same, mode)); controls++;
	}
	assert.equal(controls, 150);
	t.diagnostic(`${controls} missing, duplicated, changed-width or changed-phase observations refused`);
});
