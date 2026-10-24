/**
 * Closed deployment controls for separate instrumented PHP-Wasm drivers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CanonicalBuildError } from "../../src/build/build-error.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	phpWasmEntryProbeDeploymentFiles, phpWasmInventory
	, reportPhpWasmCaptureFailure, retainFailedPhpWasmDeployment
} from "./type-corpus-php-wasm-install.mjs";

const recorder = () => {
	const lines = [];
	return { lines, t: { diagnostic: line => { lines.push(line); } } };
};

test("installed PHP-Wasm probes retain the legacy driver closure", () => {
	assert.deepEqual(phpWasmEntryProbeDeploymentFiles(true), [
		{ source: "tests/fixtures/php-wasm-subtype-entry/driver.mjs", destination: "driver.mjs" }
		, { source: "tests/helpers/php-wasm-subtype-entry-trace.mjs", destination: "entry-trace.mjs" }
		, { source: "tests/helpers/php-wasm-subtype-entry-cases.mjs", destination: "entry-cases.mjs" }
	]);
});

test("installed PHP-Wasm probes accept one explicit closed driver dependency set", () => {
	const selected = {
		driver: "tests/fixtures/php-wasm-refinement-entry/driver.mjs"
		, support: [
			{ source: "tests/helpers/php-wasm-subtype-entry-trace.mjs", destination: "entry-trace.mjs" }
		]
	};
	assert.deepEqual(phpWasmEntryProbeDeploymentFiles(selected), [
		{ source: selected.driver, destination: "driver.mjs" }, ...selected.support
	]);
	assert.deepEqual(selected.support, [
		{ source: "tests/helpers/php-wasm-subtype-entry-trace.mjs", destination: "entry-trace.mjs" }
	]);
});

test("installed PHP-Wasm probe drivers cannot escape or overlap the deployment", () => {
	const valid = { driver: "tests/fixtures/php-wasm-refinement-entry/driver.mjs", support: [] };
	for(const value of [
		null, false, {}, { ...valid, extra: true }
		, { ...valid, driver: "src/driver.mjs" }
		, { ...valid, driver: "tests/../src/driver.mjs" }
		, { ...valid, support: [{ source: "tests/helpers/x.mjs", destination: "driver.mjs" }] }
		, { ...valid, support: [{ source: "tests/helpers/x.mjs", destination: "../x.mjs" }] }
		, { ...valid, support: [
			{ source: "tests/helpers/x.mjs", destination: "x.mjs" }
			, { source: "tests/helpers/y.mjs", destination: "x.mjs" }
		] }
	]) assert.throws(() => phpWasmEntryProbeDeploymentFiles(value));
});

test("failed PHP-Wasm consumer captures surface their own stderr and stdout", async () => {
	const failure = await processBuildRunner.capture({
		command: process.execPath
		, args: ["-e", "process.stdout.write('partial'); console.error('Error: probe entry sequence differs'); process.exit(3);"]
		, cwd: tmpdir(), env: {}, timeoutMs: 30_000
	}).then(() => assert.fail("expected the consumer to fail"), error => error);
	assert.equal(failure.name, "CanonicalBuildError");
	const { lines, t } = recorder();
	assert.equal(reportPhpWasmCaptureFailure(t, "probe: PHP-Wasm Node embedded/startup/weak", failure), true);
	assert.deepEqual(lines, [
		"probe: PHP-Wasm Node embedded/startup/weak: build-command-failed (exit 3)"
		, `probe: PHP-Wasm Node embedded/startup/weak stderr: ${JSON.stringify("Error: probe entry sequence differs\n")}`
		, `probe: PHP-Wasm Node embedded/startup/weak stdout: ${JSON.stringify("partial")}`
	]);
});

test("PHP-Wasm capture diagnostics keep only a bounded tail", () => {
	const stderr = "head-" + "x".repeat(5000) + "-tail";
	const error = new CanonicalBuildError("build-command-failed", "node exited with status 1"
		, { details: { exitCode: 1, signal: null, stderr, stdout: "" } });
	const { lines, t } = recorder();
	reportPhpWasmCaptureFailure(t, "probe", error);
	assert.equal(lines[1], `probe stderr (last 4096 of ${stderr.length} retained characters): ${JSON.stringify(stderr.slice(-4096))}`);
	assert.ok(!lines[1].includes("head-") && lines[1].endsWith('-tail"'));
	const signalled = recorder();
	reportPhpWasmCaptureFailure(signalled.t, "probe", new CanonicalBuildError("build-command-failed", "killed"
		, { details: { exitCode: null, signal: "SIGKILL", stderr: "", stdout: "" } }));
	assert.equal(signalled.lines[0], "probe: build-command-failed (signal SIGKILL)");
});

test("PHP-Wasm capture diagnostics ignore failures without captured process details", () => {
	for(const error of [
		new Error("plain"), new assert.AssertionError({ message: "differs" }), null
		, Object.assign(new Error("lookalike"), { details: { stderr: "x" } })
		, new CanonicalBuildError("build-command-failed", "malformed", { details: ["stderr"] })
	]) {
		const { lines, t } = recorder();
		assert.equal(reportPhpWasmCaptureFailure(t, "probe", error), false);
		assert.deepEqual(lines, []);
	}
});

test("failed PHP-Wasm deployments are retained without the pinned host package", async () => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-retention-"));
	try
	{
		const deployment = join(scratch, "relocated"), root = join(scratch, "retained");
		for(const [path, text] of [
			["node.mjs", "node"], ["driver.mjs", "driver"]
			, ["request-embedded.json", "{}"]
			, ["node_modules/php-wasm/php-node.wasm", "host"]
			, ["node_modules/php-wasm/package.json", "{}"]
			, ["node_modules/php-wasm-sibling/index.mjs", "sibling"]
			, ["node_modules/component/compiled/component.json", "component"]
			, ["vendor/autoload.php", "<?php"]
		]) await saveLakeFile(deployment, path, text);
		const before = await phpWasmInventory(deployment);
		const failure = {
			label: "probe", command: "node", args: ["node.mjs"]
			, code: "build-command-failed", exitCode: 1, signal: null
			, stderr: "Error: differs\n", stdout: ""
		};
		const target = await retainFailedPhpWasmDeployment({ root, name: "probe-embedded-startup-weak", deployment, failure });
		assert.equal(target, join(root, "probe-embedded-startup-weak"));
		assert.deepEqual(Object.keys(await phpWasmInventory(join(target, "deployment"))).sort(), [
			"driver.mjs", "node.mjs"
			, "node_modules/component/compiled/component.json"
			, "node_modules/php-wasm-sibling/index.mjs"
			, "request-embedded.json", "vendor/autoload.php"
		]);
		assert.deepEqual(JSON.parse(await readFile(join(target, "failure.json"), "utf8")), {
			schemaVersion: 1, ...failure
			, stderr: { characters: 15, tail: "Error: differs\n" }, stdout: { characters: 0, tail: "" }
			, omitted: ["deployment/node_modules/php-wasm"]
		});
		const large = { ...failure, stderr: "head-" + "e".repeat(9000) + "-tail", stdout: "o".repeat(5000) };
		const bounded = await retainFailedPhpWasmDeployment({ root, name: "large-output", deployment, failure: large });
		const record = JSON.parse(await readFile(join(bounded, "failure.json"), "utf8"));
		assert.deepEqual(record.stderr, { characters: large.stderr.length, tail: large.stderr.slice(-4096) });
		assert.deepEqual(record.stdout, { characters: 5000, tail: "o".repeat(4096) });
		assert.ok(!JSON.stringify(record).includes("head-"));
		await assert.rejects(retainFailedPhpWasmDeployment({ root, name: "missing-stream", deployment
			, failure: { ...failure, stdout: undefined } }));
		assert.deepEqual(await phpWasmInventory(deployment), before, "retention only reads the failed deployment");
		await assert.rejects(retainFailedPhpWasmDeployment({ root, name: "probe-embedded-startup-weak", deployment, failure }));
		for(const name of ["", "../escape", "a/b", ".hidden"])
			await assert.rejects(retainFailedPhpWasmDeployment({ root, name, deployment, failure }));
		await assert.rejects(retainFailedPhpWasmDeployment({ root: "", name: "other", deployment, failure }));
	}
	finally
	{ await rm(scratch, { recursive: true, force: true }); }
});

test("hosted PHP-Wasm entry probes upload a retained failed deployment", async () => {
	for(const prefix of [
		"php-wasm-refinement-entry", "php-wasm-indexed-refinement-entry"
		, "php-wasm-owned-refinement-entry", "php-wasm-callback-entry"
	]) {
		const workflow = await readFile(`.github/workflows/${prefix}.yml`, "utf8");
		const root = `build/${prefix}-failed-deployments`;
		const acceptance = workflow.slice(workflow.indexOf("        id: acceptance\n"));
		const step = acceptance.slice(0, acceptance.indexOf("\n      - name: "));
		assert.ok(step.includes(`\n          LEAN_BRIDGE_PHP_WASM_FAILED_DEPLOYMENTS: ${root}\n`), prefix);
		const upload = acceptance.slice(acceptance.indexOf("uses: actions/upload-artifact@v7"));
		const paths = upload.slice(upload.indexOf("path: |\n"), upload.indexOf("if-no-files-found:"));
		assert.ok(paths.includes(`\n            ${root}/\n`), prefix);
		assert.equal(workflow.split("LEAN_BRIDGE_PHP_WASM_FAILED_DEPLOYMENTS").length, 2, prefix);
	}
});
