/**
 * Preserve the reason for child failures even when both output streams are empty.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

test("process diagnostics retain a nonzero exit status with empty output", async () => {
	await assert.rejects(processBuildRunner.capture({
		command: process.execPath, args: ["-e", "process.exit(7)"]
		, cwd: process.cwd()
	}), error => {
		assert.equal(error.code, "build-command-failed");
		assert.equal(error.details.exitCode, 7);
		assert.equal(error.details.signal, null);
		assert.equal(error.details.stdout, "");
		assert.equal(error.details.stderr, "");
		assert.match(error.message, /exited with status 7/u);
		return true;
	});
});

test("process diagnostics distinguish signal termination from an exit status", async () => {
	await assert.rejects(processBuildRunner.capture({
		command: process.execPath
		, args: ["-e", "process.kill(process.pid, 'SIGTERM')"]
		, cwd: process.cwd()
	}), error => {
		assert.equal(error.code, "build-command-failed");
		assert.equal(error.details.exitCode, null);
		assert.equal(error.details.signal, "SIGTERM");
		assert.equal(error.details.stdout, "");
		assert.equal(error.details.stderr, "");
		assert.match(error.message, /terminated by signal SIGTERM/u);
		return true;
	});
});

test("process diagnostics leave successful result records unchanged", async () => {
	assert.deepEqual(await processBuildRunner.capture({
		command: process.execPath
		, args: ["-e", "process.stdout.write('out'); process.stderr.write('err');"]
		, cwd: process.cwd()
	}), { code: 0, stdout: "out", stderr: "err" });
});
