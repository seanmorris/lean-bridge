/**
 * Source and negative controls for directional callback Subtypes in PHP-Wasm.
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
import { callbackSubtypeConfiguration } from "./callback-subtype-fixture.mjs";
import {
	callbackSubtypePhpWasmCaller, callbackSubtypePhpWasmConfiguration
	, callbackSubtypePhpWasmExpected, callbackSubtypePhpWasmRequest
	, checkCallbackSubtypePhpWasmExecutions
} from "./callback-subtype-php-wasm-fixture.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

test("callback Subtype PHP-Wasm preserves both author routes and the full caller", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const configuration = callbackSubtypePhpWasmConfiguration(route);
		validateExportConfiguration(configuration);
		assert.deepEqual({ ...configuration, targets: callbackSubtypeConfiguration(route).targets }
			, callbackSubtypeConfiguration(route));
	}
	const weak = await callbackSubtypePhpWasmCaller("weak");
	const strict = await callbackSubtypePhpWasmCaller("strict");
	assert.equal(strict, weak.replace("declare(strict_types=0);", "declare(strict_types=1);"));
	for(const marker of ["call_host(with_recovery", "call_host_container(with_recovery"
		, "make_closure", "make_container_closure", "callback exception identity"
		, "nested recovery stops callback", "nested closure closes idempotently"])
		assert.ok(weak.includes(marker), marker);
	assert.equal(weak.includes("vendor/autoload.php"), false);
	for(const invalid of [undefined, "", "source", false])
	{
		assert.throws(() => callbackSubtypePhpWasmConfiguration(invalid));
		await assert.rejects(callbackSubtypePhpWasmCaller(invalid));
		assert.throws(() => callbackSubtypePhpWasmRequest(invalid));
	}
	for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(callbackSubtypePhpWasmRequest(arrangement));
		assert.equal(request.module, "LeanCallbacksubtypes");
		assert.deepEqual(request.operations, { probe: "call_host" });
	}
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("callback Subtype PHP-Wasm caller parses in both lexical modes", {
	skip: !existsSync(php) && "Select LEAN_BRIDGE_PHP for syntax controls"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-callback-subtype-php-wasm-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of ["weak", "strict"])
	{
		const path = `${mode}.php`;
		await saveLakeFile(root, path, await callbackSubtypePhpWasmCaller(mode));
		const result = await runCopied(php, ["-n", "-l", path], root, copiedCleanEnvironment);
		assert.equal(result.stderr, "");
		assert.match(result.stdout, /No syntax errors detected/u);
	}
});

test("callback Subtype PHP-Wasm observations require every host context", () => {
	const libraries = ["component.so", "runtime.so"];
	const evidence = { component: { library: libraries[0] }, runtime: { library: libraries[1] }
		, executions: phpWasmExecutionTuples.map(tuple => {
			const [realm, arrangement, loading, mode] = tuple.split("/");
			return { realm, arrangement, loading, mode
				, observation: { ...callbackSubtypePhpWasmExpected }
				, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
					, libraries: loading === "startup" || stage === "complete" ? [...libraries] : [] })) };
		}) };
	checkCallbackSubtypePhpWasmExecutions(evidence);
	for(const mutate of [
		item => { item.executions.pop(); }
		, item => { item.executions[0].observation.rejections--; }
		, item => { item.executions[0].phases[2].libraries = [...libraries]; }
		, item => { item.executions[0].mode = "unknown"; }
		, item => { item.runtime.library = item.component.library; }
	]) {
		const changed = structuredClone(evidence); mutate(changed);
		assert.throws(() => checkCallbackSubtypePhpWasmExecutions(changed));
	}
});

test("callback Subtype PHP-Wasm remains a separate recurring gate", async () => {
	const { readFile } = await import("node:fs/promises");
	const workflow = await readFile(".github/workflows/callback-subtype-php-wasm.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.equal(manifest.scripts["test:callback-subtype-php-wasm"]
		, "LEAN_BRIDGE_CALLBACK_SUBTYPE_PHP_WASM_TEST=1 node --test --test-concurrency=1 tests/callback-subtype-php-wasm.test.mjs");
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "npm run test:callback-subtype-php-wasm"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "check-callback-subtype-php-wasm-reports.mjs"
		, "if: always()\n        uses: actions/upload-artifact@v7"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(workflow.includes(required), required);
});
