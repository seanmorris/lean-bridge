/**
 * Source-only controls for the future installed PHP-Wasm zero-payload lane.
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
import {
	zeroPayloadPhpCaller, zeroPayloadPhpRoutes, zeroPayloadPhpSelection
} from "./zero-payload-checked-record-php-fixture.mjs";
import {
	adaptZeroPayloadPhpWasm, zeroPayloadPhpWasmCaller
	, checkZeroPayloadPhpWasmExecutions, checkZeroPayloadPhpWasmModel
	, zeroPayloadPhpWasmParameterRefinements
	, zeroPayloadPhpWasmRefinements
	, zeroPayloadPhpWasmExpected, zeroPayloadPhpWasmRequest
	, zeroPayloadPhpWasmSelection, zeroPayloadPhpWasmSettings
} from "./zero-payload-checked-record-php-wasm-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

test("zero-payload PHP-Wasm retains all four independent routes and targets only PHP-Wasm", () => {
	for(const route of zeroPayloadPhpRoutes)
	{
		const native = zeroPayloadPhpSelection(route);
		const selected = zeroPayloadPhpWasmSelection(route);
		validateExportConfiguration(selected.configuration);
		assert.deepEqual({ ...selected.configuration, targets: native.configuration.targets }, native.configuration);
		assert.deepEqual(selected.configuration.targets, { "php-wasm": zeroPayloadPhpWasmSettings });
		assert.deepEqual(zeroPayloadPhpWasmExpected(route), {
			...(selected.resultOnly
				? { calls: 9, checks: 39, recoveries: 0, rejections: 0, snapshots: 9 }
				: { calls: 30, checks: 81, recoveries: 8, rejections: 8, snapshots: 30 })
			, word_bits: 32, php: "8.4.1"
		});
	}
	for(const route of [undefined, "ordinary", true]) assert.throws(() => zeroPayloadPhpWasmSelection(route));
});

test("zero-payload PHP-Wasm caller removes direct loading and binds route plus strictness", async () => {
	for(const route of zeroPayloadPhpRoutes) for(const strictness of ["weak", "strict"])
	{
		const source = await zeroPayloadPhpWasmCaller(route, strictness);
		assert.equal(source, adaptZeroPayloadPhpWasm(await zeroPayloadPhpCaller(), route, strictness));
		assert.equal(source.includes("vendor/autoload.php"), false);
		assert.equal(source.includes("SCRIPT_FILENAME"), false);
		assert.match(source, new RegExp(`declare\\(strict_types=${strictness === "strict" ? 1 : 0}\\);`, "u"));
		assert.match(source, new RegExp(`check_zero_payload_records\\(${route.startsWith("result-only-") ? "true" : "false"}, '${route.endsWith("reviewed-ir") ? "value" : "arg"}'\\)`, "u"));
	}
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("zero-payload PHP-Wasm caller parses in both lexical modes", { skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP for PHP syntax checks" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-php-wasm-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of zeroPayloadPhpRoutes) for(const strictness of ["weak", "strict"])
	{
		const file = `${route}-${strictness}.php`;
		await saveLakeFile(root, file, await zeroPayloadPhpWasmCaller(route, strictness));
		const result = await runCopied(php, ["-n", "-l", join(root, file)], root);
		assert.equal(result.stderr, ""); assert.ok(result.stdout.startsWith("No syntax errors detected in "));
	}
});

test("zero-payload PHP-Wasm probes a selected public export in both installed arrangements", () => {
	for(const route of zeroPayloadPhpRoutes) for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(zeroPayloadPhpWasmRequest(route, arrangement));
		assert.deepEqual(request, {
			module: "LeanZeropayloadcheckedrecords"
			, operations: { probe: route.startsWith("result-only-") ? "witnesses" : "witness_count" }
			, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-zeropayloadcheckedrecords/wasm/bootstrap.php"
		});
	}
	for(const value of [undefined, "invalid", true]) assert.throws(() => zeroPayloadPhpWasmRequest("ordinary-source", value));
});

test("zero-payload PHP-Wasm model controls reject native, incomplete and divergent models", () => {
	for(const route of zeroPayloadPhpRoutes)
	{
		const { expected, reviewed } = zeroPayloadPhpWasmSelection(route);
		const model = {
			profile: "php-wasm-copied-v1", pointerBits: 32, byteOrder: "little"
			, schemaVersion: reviewed ? 3 : 2, bindingIr: structuredClone(expected)
			, exports: expected.declarations.map(declaration => {
				const refinements = zeroPayloadPhpWasmRefinements(expected, declaration);
				return { name: declaration.source.declaration, ...(refinements ? { refinements } : {}) };
			})
		};
		checkZeroPayloadPhpWasmModel(model, route);
		assert.ok(model.exports.some(item => item.refinements === undefined), "a plain Marker export carries no refinements");
		assert.ok(model.exports.some(item => item.refinements?.result?.kind === "checked-record"));
		if(!route.startsWith("result-only-"))
		{
			assert.ok(model.exports.some(item => item.refinements?.parameters[0]?.kind === "variant"));
			assert.ok(model.exports.some(item => item.refinements?.parameters[0]?.constructor === "ZeroPayloadCheckedRecords.mkAbsent"));
		}
		for(const mutate of [
			item => { item.profile = "native-library-v1"; }
			, item => { item.pointerBits = 64; }
			, item => { item.byteOrder = "big"; }
			, item => { item.schemaVersion = reviewed ? 2 : 3; }
			, item => { item.exports.pop(); }
			, item => { item.exports[0].name = "ZeroPayloadCheckedRecords.unknown"; }
			, item => { item.exports.find(entry => entry.refinements?.result?.kind === "checked-record").refinements.result.constructor = "ZeroPayloadCheckedRecords.mkWitness"; }
			, item => { item.exports.find(entry => entry.refinements?.result?.kind === "checked-record").refinements.result.arguments = []; }
			, item => { item.exports.find(entry => entry.refinements === undefined).refinements = { parameters: [null], result: null }; }
			, item => { item.exports.find(entry => entry.refinements?.result?.kind === "array" || entry.refinements?.result?.kind === "option").refinements.result.arguments[0].constructor = "ZeroPayloadCheckedRecords.mkWitness"; }
			, item => { item.bindingIr.types.find(type => type.name === "Token").fields[0].name = "renamed"; }
		]) {
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => checkZeroPayloadPhpWasmModel(changed, route));
		}
	}
});

test("plain PHP-Wasm exports contribute no checked parameter refinements", () => {
	assert.deepEqual(zeroPayloadPhpWasmParameterRefinements({}), []);
	const parameters = [null, {
		kind: "checked-record", constructor: "ZeroPayloadCheckedRecords.mkWitness"
	}];
	assert.strictEqual(zeroPayloadPhpWasmParameterRefinements({
		refinements: { parameters }
	}), parameters);
});

test("zero-payload PHP-Wasm observations require every host context and lazy loading boundary", () => {
	for(const route of zeroPayloadPhpRoutes)
	{
		const libraries = ["component.so", "runtime.so"];
		const evidence = {
			component: { library: libraries[0] }, runtime: { library: libraries[1] }
			, executions: phpWasmExecutionTuples.map(tuple => {
				const [realm, arrangement, loading, mode] = tuple.split("/");
				return { realm, arrangement, loading, mode
					, observation: zeroPayloadPhpWasmExpected(route)
					, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
						, libraries: loading === "startup" || stage === "complete" ? [...libraries] : [] })) };
			})
		};
		checkZeroPayloadPhpWasmExecutions(evidence, route);
		for(const mutate of [
			item => { item.executions.pop(); }
			, item => { item.executions[0].loading = "unknown"; }
			, item => { item.executions[0].phases[2].libraries = [...libraries]; }
			, item => { item.executions[0].observation.checks++; }
			, item => { item.runtime.library = item.component.library; }
		]) {
			const changed = structuredClone(evidence); mutate(changed);
			assert.throws(() => checkZeroPayloadPhpWasmExecutions(changed, route));
		}
	}
});
