/**
 * Preserve complete process observations before the owning harness asserts them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

/**
 * Capture a command with only the explicitly supplied environment.
 * Failed starts, nonzero exits, signals and timeouts are returned, not rejected.
 * Output has no maxBuffer limit and is retained until the process streams close.
 *
 * @param command - Executable selected by the caller.
 * @param args - Exact argument vector, excluding the executable.
 * @param cwd - Explicit working directory.
 * @param environment - Complete explicit child environment, without ambient merge.
 * @param timeoutMs - Maximum process duration before terminating its process group.
 */
export const captureOwnedPhpCallback = (command, args, cwd, environment, timeoutMs = 180000) => {
	assert.equal(typeof command, "string"); assert.ok(command.length > 0);
	assert.ok(Array.isArray(args) && args.every(value => typeof value === "string"));
	assert.equal(typeof cwd, "string"); assert.ok(cwd.length > 0);
	assert.ok(environment && typeof environment === "object" && !Array.isArray(environment));
	assert.ok(Object.values(environment).every(value => typeof value === "string"));
	assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 3600000);
	const vector = [...args], env = { ...environment };
	return new Promise(resolve => {
		const stdout = [], stderr = [];
		let spawnError = null, timedOut = false, child;
		const finish = (code, signal) => resolve({ command, args: vector, cwd, env
			, code, signal, timedOut, spawnError
			, stdout: Buffer.concat(stdout).toString("utf8")
			, stderr: Buffer.concat(stderr).toString("utf8") });
		try
		{
			child = spawn(command, vector, { cwd, env, stdio: ["ignore", "pipe", "pipe"]
				, detached: process.platform !== "win32" });
		} catch(error)
		{
			spawnError = error.message; finish(null, null); return;
		}
		const timer = setTimeout(() => {
			timedOut = true;
			if(process.platform !== "win32" && child.pid)
			{
				try
				{ process.kill(-child.pid, "SIGKILL"); }
				catch(error)
				{ if(error.code !== "ESRCH") spawnError ??= error.message; }
			} else child.kill("SIGKILL");
		}, timeoutMs);
		child.stdout.on("data", bytes => stdout.push(bytes));
		child.stderr.on("data", bytes => stderr.push(bytes));
		child.on("error", error => { spawnError = error.message; });
		child.on("close", (code, signal) => { clearTimeout(timer); finish(code, signal); });
	});
};
