/**
 * Source-only controls for the future installed PHP-Wasm value-index lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { checkedRecordValueIndexBrowserRoutes } from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexPhpCaller, checkedRecordValueIndexPhpSelection
} from "./checked-record-value-index-php-fixture.mjs";
import {
	adaptCheckedRecordValueIndexPhpWasm, checkedRecordValueIndexPhpWasmCaller
	, checkCheckedRecordValueIndexPhpWasmExecutions, checkCheckedRecordValueIndexPhpWasmModel
	, checkedRecordValueIndexPhpWasmExpected, checkedRecordValueIndexPhpWasmRequest
	, checkedRecordValueIndexPhpWasmSelection, checkedRecordValueIndexPhpWasmSettings
} from "./checked-record-value-index-php-wasm-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

test("value-index PHP-Wasm retains all four independent routes and targets only PHP-Wasm", () => {
	for(const route of checkedRecordValueIndexBrowserRoutes)
	{
		const native = checkedRecordValueIndexPhpSelection(route);
		const selected = checkedRecordValueIndexPhpWasmSelection(route);
		validateExportConfiguration(selected.configuration);
		assert.deepEqual({ ...selected.configuration, targets: native.configuration.targets }, native.configuration);
		assert.deepEqual(selected.configuration.targets, { "php-wasm": checkedRecordValueIndexPhpWasmSettings });
		assert.deepEqual(checkedRecordValueIndexPhpWasmExpected(route), {
			...(selected.resultOnly
				? { calls: 8, checks: 25, recoveries: 0, rejections: 0, snapshots: 0 }
				: { calls: 28, checks: 65, recoveries: 6, rejections: 6, snapshots: 20 })
			, word_bits: 32, php: "8.4.1"
		});
	}
	for(const route of [undefined, "ordinary", true]) assert.throws(() => checkedRecordValueIndexPhpWasmSelection(route));
});

test("value-index PHP-Wasm caller removes direct loading and binds route plus strictness", async () => {
	for(const route of checkedRecordValueIndexBrowserRoutes) for(const strictness of ["weak", "strict"])
	{
		const source = await checkedRecordValueIndexPhpWasmCaller(route, strictness);
		assert.equal(source, adaptCheckedRecordValueIndexPhpWasm(await checkedRecordValueIndexPhpCaller(), route, strictness));
		assert.equal(source.includes("vendor/autoload.php"), false);
		assert.equal(source.includes("SCRIPT_FILENAME"), false);
		assert.match(source, new RegExp(`declare\\(strict_types=${strictness === "strict" ? 1 : 0}\\);`, "u"));
		assert.match(source, new RegExp(`check_value_index_records\\(${route.startsWith("result-only-") ? "true" : "false"}, '${route.endsWith("reviewed-ir") ? "value" : "arg"}'\\)`, "u"));
	}
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("value-index PHP-Wasm caller parses in both lexical modes", { skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP for PHP syntax checks" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-php-wasm-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of checkedRecordValueIndexBrowserRoutes) for(const strictness of ["weak", "strict"])
	{
		const file = `${route}-${strictness}.php`;
		await saveLakeFile(root, file, await checkedRecordValueIndexPhpWasmCaller(route, strictness));
		const result = await runCopied(php, ["-n", "-l", join(root, file)], root);
		assert.equal(result.stderr, ""); assert.ok(result.stdout.startsWith("No syntax errors detected in "));
	}
});

test("value-index PHP-Wasm probes a selected public export in both installed arrangements", () => {
	for(const route of checkedRecordValueIndexBrowserRoutes) for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(checkedRecordValueIndexPhpWasmRequest(route, arrangement));
		assert.deepEqual(request, {
			module: "LeanCheckedrecordvalueindices"
			, operations: { probe: route.startsWith("result-only-") ? "produce_empty_string" : "true_bool_index" }
			, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-checkedrecordvalueindices/wasm/bootstrap.php"
		});
	}
	for(const value of [undefined, "invalid", true]) assert.throws(() => checkedRecordValueIndexPhpWasmRequest("ordinary-source", value));
});

test("value-index PHP-Wasm model controls reject native, incomplete and divergent models", () => {
	for(const route of checkedRecordValueIndexBrowserRoutes)
	{
		const { expected, reviewed } = checkedRecordValueIndexPhpWasmSelection(route);
		const record = (site, constructor) => {
			const definition = expected.types.find(item => item.id === site?.type?.id);
			return definition ? {
				kind: "checked-record", definition: definition.id.slice(5), constructor
				, fields: definition.fields.map(field => field.name)
			} : null;
		};
		const model = {
			profile: "php-wasm-copied-v1", pointerBits: 32, byteOrder: "little"
			, schemaVersion: reviewed ? 3 : 2, bindingIr: structuredClone(expected)
			, exports: expected.declarations.map(declaration => {
				const trees = declaration.source.extensions["lean-lang.org/refinements"];
				return {
					name: declaration.source.declaration
					, refinements: {
						parameters: declaration.parameters.map((site, index) => record(site
							, trees?.parameters[index]?.constructor ?? null))
						, result: record(declaration.result, null)
					}
				};
			})
		};
		checkCheckedRecordValueIndexPhpWasmModel(model, route);
		for(const mutate of [
			item => { item.profile = "native-library-v1"; }
			, item => { item.pointerBits = 64; }
			, item => { item.byteOrder = "big"; }
			, item => { item.schemaVersion = reviewed ? 2 : 3; }
			, item => { item.exports.pop(); }
			, item => { item.exports[0].name = "CheckedRecordValueIndices.unknown"; }
			, item => {
				item.exports.find(entry => entry.refinements.parameters.length)
					.refinements.parameters.pop();
			}
			, item => {
				const entry = item.exports.find(candidate => candidate.refinements.parameters
					.some(value => value?.kind === "checked-record"));
				if(entry) entry.refinements.parameters.find(value => value?.kind === "checked-record").constructor
					= "CheckedRecordValueIndices.wrong";
				else item.exports.find(candidate => candidate.refinements.result !== null)
					.refinements.result.constructor = "CheckedRecordValueIndices.wrong";
			}
			, item => { item.bindingIr.types.find(type => type.name === "On").fields[0].name = "renamed"; }
		]) {
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => checkCheckedRecordValueIndexPhpWasmModel(changed, route));
		}
	}
});

test("value-index PHP-Wasm observations require every host context and lazy loading boundary", () => {
	for(const route of checkedRecordValueIndexBrowserRoutes)
	{
		const libraries = ["component.so", "runtime.so"];
		const evidence = {
			component: { library: libraries[0] }, runtime: { library: libraries[1] }
			, executions: phpWasmExecutionTuples.map(tuple => {
				const [realm, arrangement, loading, mode] = tuple.split("/");
				return { realm, arrangement, loading, mode
					, observation: checkedRecordValueIndexPhpWasmExpected(route)
					, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
						, libraries: loading === "startup" || stage === "complete" ? [...libraries] : [] })) };
			})
		};
		checkCheckedRecordValueIndexPhpWasmExecutions(evidence, route);
		for(const mutate of [
			item => { item.executions.pop(); }
			, item => { item.executions[0].loading = "unknown"; }
			, item => { item.executions[0].phases[2].libraries = [...libraries]; }
			, item => { item.executions[0].observation.checks++; }
			, item => { item.runtime.library = item.component.library; }
		]) {
			const changed = structuredClone(evidence); mutate(changed);
			assert.throws(() => checkCheckedRecordValueIndexPhpWasmExecutions(changed, route));
		}
	}
});
