/**
 * Source-only controls for the future installed PHP-Wasm dependent lane.
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
import { dependentCheckedRecordRoutes } from "./dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordPhpCaller, dependentCheckedRecordPhpSelection
} from "./dependent-checked-record-php-fixture.mjs";
import {
	adaptDependentCheckedRecordPhpWasm, dependentCheckedRecordPhpWasmCaller
	, checkDependentCheckedRecordPhpWasmExecutions, checkDependentCheckedRecordPhpWasmModel
	, dependentCheckedRecordPhpWasmExpected, dependentCheckedRecordPhpWasmRequest
	, dependentCheckedRecordPhpWasmSelection, dependentCheckedRecordPhpWasmSettings
} from "./dependent-checked-record-php-wasm-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

test("dependent PHP-Wasm retains all four independent routes and targets only PHP-Wasm", () => {
	for(const route of dependentCheckedRecordRoutes)
	{
		const native = dependentCheckedRecordPhpSelection(route);
		const selected = dependentCheckedRecordPhpWasmSelection(route);
		validateExportConfiguration(selected.configuration);
		assert.deepEqual({ ...selected.configuration, targets: native.configuration.targets }, native.configuration);
		assert.deepEqual(selected.configuration.targets, { "php-wasm": dependentCheckedRecordPhpWasmSettings });
		assert.deepEqual(dependentCheckedRecordPhpWasmExpected(route), {
			...(selected.resultOnly
				? { calls: 513, checks: 516, recoveries: 0, rejections: 0, snapshots: 513 }
				: { calls: 1289, checks: 2326, recoveries: 258, rejections: 258, snapshots: 1289 })
			, word_bits: 32, php: "8.4.1"
		});
	}
	for(const route of [undefined, "ordinary", true]) assert.throws(() => dependentCheckedRecordPhpWasmSelection(route));
});

test("dependent PHP-Wasm caller removes direct loading and binds route plus strictness", async () => {
	for(const route of dependentCheckedRecordRoutes) for(const strictness of ["weak", "strict"])
	{
		const source = await dependentCheckedRecordPhpWasmCaller(route, strictness);
		assert.equal(source, adaptDependentCheckedRecordPhpWasm(await dependentCheckedRecordPhpCaller(), route, strictness));
		assert.equal(source.includes("vendor/autoload.php"), false);
		assert.equal(source.includes("SCRIPT_FILENAME"), false);
		assert.match(source, new RegExp(`declare\\(strict_types=${strictness === "strict" ? 1 : 0}\\);`, "u"));
		assert.match(source, new RegExp(`check_dependent_records\\(${route.startsWith("result-only-") ? "true" : "false"}, '${route.endsWith("reviewed-ir") ? "value" : "arg"}'\\)`, "u"));
	}
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("dependent PHP-Wasm caller parses in both lexical modes", { skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP for PHP syntax checks" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dependent-php-wasm-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of dependentCheckedRecordRoutes) for(const strictness of ["weak", "strict"])
	{
		const file = `${route}-${strictness}.php`;
		await saveLakeFile(root, file, await dependentCheckedRecordPhpWasmCaller(route, strictness));
		const result = await runCopied(php, ["-n", "-l", join(root, file)], root);
		assert.equal(result.stderr, ""); assert.ok(result.stdout.startsWith("No syntax errors detected in "));
	}
});

test("dependent PHP-Wasm probes a selected public export in both installed arrangements", () => {
	for(const route of dependentCheckedRecordRoutes) for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(dependentCheckedRecordPhpWasmRequest(route, arrangement));
		assert.deepEqual(request, {
			module: "LeanDependentrecords"
			, operations: { probe: "dependent_result" }
			, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-dependentrecords/wasm/bootstrap.php"
		});
	}
	for(const value of [undefined, "invalid", true]) assert.throws(() => dependentCheckedRecordPhpWasmRequest("ordinary-source", value));
});

test("dependent PHP-Wasm model controls reject native, incomplete and divergent models", () => {
	for(const route of dependentCheckedRecordRoutes)
	{
		const { expected, reviewed } = dependentCheckedRecordPhpWasmSelection(route);
		const record = (site, constructor) => {
			const definition = expected.types.find(item => item.id === site?.type?.id);
			return definition ? {
				kind: "checked-record", definition: definition.id.slice(5), constructor
				, fields: definition.fields.map(field => field.name)
				, arguments: structuredClone(definition.source.extensions[
					"lean-lang.org/nominal-refinements"
				].fields)
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
		checkDependentCheckedRecordPhpWasmModel(model, route);
		for(const mutate of [
			item => { item.profile = "native-library-v1"; }
			, item => { item.pointerBits = 64; }
			, item => { item.byteOrder = "big"; }
			, item => { item.schemaVersion = reviewed ? 2 : 3; }
			, item => { item.exports.pop(); }
			, item => { item.exports[0].name = "DependentRecords.unknown"; }
			, item => {
				item.exports.find(entry => entry.refinements.parameters.length)
					.refinements.parameters.pop();
			}
			, item => {
				const entry = item.exports.find(candidate => candidate.refinements.parameters
					.some(value => value?.kind === "checked-record"));
				if(entry) entry.refinements.parameters.find(value => value?.kind === "checked-record").constructor
					= "DependentRecords.wrong";
				else item.exports.find(candidate => candidate.refinements.result !== null)
					.refinements.result.constructor = "DependentRecords.wrong";
			}
			, item => { item.bindingIr.types.find(type => type.name === "Dependent").fields[0].name = "renamed"; }
			, item => {
				const entry = item.exports.find(candidate =>
					candidate.refinements.parameters.some(Boolean));
				const site = entry
					? entry.refinements.parameters.find(Boolean)
					: item.exports.find(candidate => candidate.refinements.result !== null)
						.refinements.result;
				site.arguments[1].field = "below";
			}
		]) {
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => checkDependentCheckedRecordPhpWasmModel(changed, route));
		}
	}
});

test("dependent PHP-Wasm observations require every host context and lazy loading boundary", () => {
	for(const route of dependentCheckedRecordRoutes)
	{
		const libraries = ["component.so", "runtime.so"];
		const evidence = {
			component: { library: libraries[0] }, runtime: { library: libraries[1] }
			, executions: phpWasmExecutionTuples.map(tuple => {
				const [realm, arrangement, loading, mode] = tuple.split("/");
				return { realm, arrangement, loading, mode
					, observation: dependentCheckedRecordPhpWasmExpected(route)
					, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
						, libraries: loading === "startup" || stage === "complete" ? [...libraries] : [] })) };
			})
		};
		checkDependentCheckedRecordPhpWasmExecutions(evidence, route);
		for(const mutate of [
			item => { item.executions.pop(); }
			, item => { item.executions[0].loading = "unknown"; }
			, item => { item.executions[0].phases[2].libraries = [...libraries]; }
			, item => { item.executions[0].observation.checks++; }
			, item => { item.runtime.library = item.component.library; }
		]) {
			const changed = structuredClone(evidence); mutate(changed);
			assert.throws(() => checkDependentCheckedRecordPhpWasmExecutions(changed, route));
		}
	}
});
