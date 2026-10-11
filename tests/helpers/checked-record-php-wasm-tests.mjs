/**
 * Source-only caller and observation-validator controls, not installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { checkedRecordHostConsumer, checkedRecordHostSelection, checkedRecordHostRoutes } from "./checked-record-native-fixture.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { checkedRecordPhpWasmSelection, checkedRecordPhpWasmCaller, checkedRecordPhpWasmExpected, adaptCheckedRecordPhpWasm, checkedRecordPhpWasmRequest, checkCheckedRecordPhpWasmExecutions } from "./checked-record-php-wasm-fixture.mjs";
import { checkedRecordPhpWasmRecords } from "./checked-record-php-wasm-report.mjs";

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("all four PHP-Wasm selections retain complete native assertions and constructor authority", async () => {
	for(const route of checkedRecordHostRoutes)
	{
		const selected = checkedRecordPhpWasmSelection(route), native = checkedRecordHostSelection(route, ["php-native"]);
		validateExportConfiguration(selected.configuration);
		assert.deepEqual({ ...selected, configuration: { ...selected.configuration, targets: native.configuration.targets } }, native);
		const original = await checkedRecordHostConsumer("php-native", route);
		for(const mode of ["weak", "strict"])
		{
			const caller = await checkedRecordPhpWasmCaller(route, mode);
			assert.equal(caller.slice(caller.indexOf("function check("), caller.indexOf("$low_bit = ")),
				original.slice(original.indexOf("function check("), original.indexOf('echo "checked-record-ok:')));
			assert.ok(caller.startsWith(`<?php\ndeclare(strict_types=${mode === "strict" ? 1 : 0});`));
			assert.ok(caller.includes("power(80)->plus(n(1))"));
			assert.ok(caller.includes("finally {\n        check(caller_snapshot($arguments) === $before);"));
			assert.ok(!caller.includes('require "vendor/autoload.php";'));
			assert.equal(caller.includes("function width("), !selected.resultOnly);
		}
		for(const mutate of [text => text.replace('require "vendor/autoload.php";', "")
			, text => text.replace("declare(strict_types=0);", "declare(strict_types=1);")
			, text => text + "// unexpected tail\n"
			, text => text.replace('echo "checked-record-ok:', 'echo "another-message:')])
			assert.throws(() => adaptCheckedRecordPhpWasm(mutate(original), route, "weak"));
	}
});

test("all eight PHP-Wasm checked-record callers parse in their lexical mode", {
	skip: !process.env.LEAN_BRIDGE_PHP && !existsSync(php) && "Select LEAN_BRIDGE_PHP for syntax controls"
}, async () => {
	for(const route of checkedRecordHostRoutes) for(const mode of ["weak", "strict"])
	{
		const syntax = spawnSync(php, ["-n", "-l"], { input: await checkedRecordPhpWasmCaller(route, mode), encoding: "utf8" });
		assert.equal(syntax.status, 0, syntax.stdout + syntax.stderr);
	}
});

test("PHP-Wasm probes and required originals retain full and result-only route distinctions", () => {
	for(const route of checkedRecordHostRoutes)
	{
		const resultOnly = route.startsWith("result-only-"), reviewed = route.endsWith("reviewed-ir");
		for(const arrangement of ["embedded", "composer"])
		{
			const request = JSON.parse(checkedRecordPhpWasmRequest(route, arrangement));
			assert.equal(request.module, "LeanCheckedrecords");
			assert.deepEqual(request.operations, { probe: resultOnly ? "repeated" : "width" });
		}
		const records = checkedRecordPhpWasmRecords(route);
		assert.equal(new Set(records).size, records.length);
		assert.equal(records.filter(path => path.startsWith("executions/")).length, 12);
		assert.equal(records.filter(path => path.endsWith("api.binding-ir.json")).length, reviewed ? 2 : 0);
		for(const root of ["build-0", "build-1"])
			assert.ok(records.includes(`${root}/CheckedRecords.lean`));
	}
	assert.throws(() => checkedRecordPhpWasmSelection("unknown"));
	assert.throws(() => checkedRecordPhpWasmRequest("ordinary-source", "unknown"));
	assert.throws(() => checkedRecordPhpWasmRecords("unknown"));
});

test("PHP-Wasm observations reject omitted contexts, modified counts and premature lazy loads", () => {
	for(const route of checkedRecordHostRoutes)
	{
		const expected = checkedRecordPhpWasmExpected(route);
		const executions = phpWasmExecutionTuples.map(tuple => {
			const [realm, arrangement, loading, mode] = tuple.split("/");
			return { realm, arrangement, loading, mode, observation: { ...expected }
				, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
					, libraries: loading === "startup" || stage === "complete" ? ["component.so", "runtime.so"] : [] })) };
		});
		const original = { component: { library: "component.so" }
			, runtime: { library: "runtime.so" }, executions };
		checkCheckedRecordPhpWasmExecutions(original, route);
		for(const [index, execution] of original.executions.entries())
		{
			const missing = structuredClone(original); missing.executions.splice(index, 1);
			assert.throws(() => checkCheckedRecordPhpWasmExecutions(missing, route));
			for(const key of Object.keys(expected))
			{
				const changed = structuredClone(original); changed.executions[index].observation[key] = "wrong";
				assert.throws(() => checkCheckedRecordPhpWasmExecutions(changed, route));
			}
			const missingPhase = structuredClone(original); missingPhase.executions[index].phases.pop();
			assert.throws(() => checkCheckedRecordPhpWasmExecutions(missingPhase, route));
			if(execution.loading === "lazy")
			{
				const loaded = structuredClone(original); loaded.executions[index].phases[2].libraries.push("component.so");
				assert.throws(() => checkCheckedRecordPhpWasmExecutions(loaded, route));
			}
		}
		const duplicated = structuredClone(original); duplicated.executions[0] = duplicated.executions[1];
		assert.throws(() => checkCheckedRecordPhpWasmExecutions(duplicated, route));
	}
});

test("PHP-Wasm installed selections reject ambiguous flags, routes and stale output before compilation", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-php-wasm-guards-"));
	t.after(() => rm(directory, { recursive: true }));
	const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && key !== "NODE_TEST_CONTEXT"));
	const file = resolve("tests/helpers/checked-record-php-wasm-installed-tests.mjs");
	const settings = { LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_OUTPUT: directory
		, LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/compiler" };
	const run = extra => spawnSync(process.execPath, ["--test", "--test-reporter=tap", file], {
		cwd: process.cwd(), env: { ...clean, ...settings, ...extra }, encoding: "utf8"
	});
	const invalid = [
		{ LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_TEST: "yes" }
		, { LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_ROUTES: "ordinary-source" }
		, ...["", "unknown", "ordinary-source,ordinary-source", "ordinary-source,reviewed-ir,"].map(routes => ({
			LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_TEST: "1"
			, LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_ROUTES: routes
		}))
	];
	for(const environment of invalid)
	{
		const result = run(environment);
		assert.notEqual(result.status, 0, result.stdout + result.stderr);
		assert.match(result.stdout + result.stderr, /AssertionError/u);
		assert.deepEqual(await readdir(directory), []);
	}
	await mkdir(join(directory, "ordinary-source"));
	const stale = run({ LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_TEST: "1"
		, LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_ROUTES: "ordinary-source" });
	assert.notEqual(stale.status, 0);
	assert.match(stale.stdout + stale.stderr, /Missing expected rejection/u);
	assert.deepEqual(await readdir(directory), ["ordinary-source"]);
	assert.deepEqual(await readdir(join(directory, "ordinary-source")), []);
});
