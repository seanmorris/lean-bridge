#!/usr/bin/env node
/**
 * Capture one guarded local primitive-base nominal C# installed-package run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { open, readFile, statfs, writeFile } from "node:fs/promises";

const [route, mode, attempt] = process.argv.slice(2);
assert.ok(["ordinary", "reviewed"].includes(route));
assert.ok(["full", "result-only"].includes(mode));
assert.match(attempt ?? "", /^r[0-9]+$/u);
const git = args => execFileSync("git", args, { encoding: "utf8" }).trim();
const revision = git(["rev-parse", "HEAD"]);
assert.equal(git(["diff", "HEAD", "--name-only"]), "");
const prefix = `build/vo1494-nominal-primitive-dotnet-${route}-${mode}-${attempt}-${revision.slice(0, 7)}`;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const resources = async () => {
	const disk = await statfs("/app"), memory = await readFile("/proc/meminfo", "utf8");
	return { freeMiB: Math.floor(disk.bavail * disk.bsize / 1_048_576)
		, availableMiB: Math.floor(Number(memory.match(/^MemAvailable:\s+(\d+) kB$/mu)[1]) / 1024)
		, load: Number((await readFile("/proc/loadavg", "utf8")).toString().split(" ")[0]) };
};
const initial = await resources(), loadCeiling = 8;
assert.ok(initial.freeMiB >= 2048 && initial.availableMiB >= 2048 && initial.load < loadCeiling, JSON.stringify(initial));
const environment = {
	LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_TEST: "1"
	, LEAN_BRIDGE_DOTNET: "/app/.toolchains/dotnet/dotnet"
	, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_ROUTES: route
	, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_MODES: mode
	, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_OUTPUT: prefix + "-records"
	, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_MAX_LOAD: String(loadCeiling)
	, LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
	, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
	, LEAN_NUM_THREADS: "1", MSBUILDDISABLENODEREUSE: "1"
	, OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
};
const command = "/usr/bin/nice";
const args = ["-n", "10", "/usr/bin/ionice", "-c", "3"
	, "/usr/bin/taskset", "-c", "7", process.execPath
	, "--test", "--test-concurrency=1"
	, "tests/helpers/nominal-primitive-subtype-dotnet-installed-tests.mjs"];
await writeFile(prefix + ".start.json", JSON.stringify({
	revision, route, mode, attempt, loadCeiling, started: new Date().toISOString()
	, runnerSha256: hash(await readFile(import.meta.filename))
	, command, args, environment, initial
}, null, 2) + "\n", { flag: "wx" });
const log = await open(prefix + ".tap", "wx");
const child = spawn(command, args, {
	cwd: "/app"
	, env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_"))), ...environment }
	, stdio: ["ignore", log.fd, log.fd], detached: true
});
process.stdout.write(JSON.stringify({ pid: child.pid, prefix, initial }) + "\n");
let stopReason = null, samples = 0, killTimer;
const minimum = { freeMiB: initial.freeMiB, availableMiB: initial.availableMiB };
const timer = setInterval(async () => {
	try
	{
		const current = await resources();
		minimum.freeMiB = Math.min(minimum.freeMiB, current.freeMiB);
		minimum.availableMiB = Math.min(minimum.availableMiB, current.availableMiB);
		if((current.freeMiB < 2048 || current.availableMiB < 2048) && !stopReason)
		{
			stopReason = current.freeMiB < 2048 ? "disk-floor" : "memory-floor";
			process.kill(-child.pid, "SIGTERM");
				killTimer = setTimeout(() => {
					try
					{
						process.kill(-child.pid, "SIGKILL");
					}
					catch(error)
					{
						if(error.code !== "ESRCH") process.stderr.write(String(error) + "\n");
					}
				}, 5000);
		}
		if(++samples % 6 === 0) process.stdout.write(JSON.stringify({ pid: child.pid, ...current, stopReason }) + "\n");
	}
		catch(error)
		{
			process.stderr.write(String(error) + "\n");
		}
}, 5000);
const end = await new Promise(resolve => {
	child.once("error", error => resolve({ code: null, signal: null, error: String(error) }));
	child.once("close", (code, signal) => resolve({ code, signal }));
});
clearInterval(timer); clearTimeout(killTimer); await log.close();
const result = { ...end, finished: new Date().toISOString(), minimum
	, final: await resources(), stopReason
	, tapSha256: hash(await readFile(prefix + ".tap")) };
await writeFile(prefix + ".end.json", JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify(result) + "\n");
assert.equal(git(["rev-parse", "HEAD"]), revision);
assert.equal(git(["diff", "HEAD", "--name-only"]), "");
process.exitCode = end.code === 0 && !stopReason ? 0 : 1;
