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

test("process diagnostics fail closed when ordinary output exceeds its limit"
	, async () => {
		await assert.rejects(processBuildRunner.capture({
			command: process.execPath
			, args: ["-e", "process.stdout.write('x'.repeat(65))"]
			, cwd: process.cwd(), maximumOutputBytes: 64
		}), { code: "build-output-limit" });
	}
);

test("discard-only commands retain bounded tails without killing the process"
	, async () => {
		const result = await processBuildRunner.capture({
			command: process.execPath
			, args: [
				"-e"
				, [
					"process.stdout.write('a'.repeat(40) + 'TAIL-OUT')"
					, "process.stderr.write('b'.repeat(40) + 'TAIL-ERR')"
				].join(";")
			]
			, cwd: process.cwd(), outputPolicy: "bounded-tail"
			, maximumOutputBytes: 16
		});
		assert.deepEqual(result, {
			code: 0, stdout: "aaaaaaaaTAIL-OUT", stderr: "bbbbbbbbTAIL-ERR"
		});
	}
);

test("bounded command failures report observed and truncated output", async () => {
	await assert.rejects(processBuildRunner.capture({
		command: process.execPath
		, args: ["-e", "process.stderr.write('z'.repeat(80)); process.exit(9)"]
		, cwd: process.cwd(), outputPolicy: "bounded-tail"
		, maximumOutputBytes: 16
	}), error => {
		assert.equal(error.code, "build-command-failed");
		assert.equal(error.details.outputPolicy, "bounded-tail");
		assert.equal(error.details.stderrBytes, 80);
		assert.equal(error.details.stderrTruncated, true);
		assert.equal(error.details.stderr, "z".repeat(16));
		return true;
	});
});
