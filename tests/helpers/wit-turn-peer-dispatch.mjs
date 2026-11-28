/** @file Exercise the mixed worker rendezvous across two independently loaded native adapters. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const run = promisify(execFile);
test("two WIT dispatchers reenter on one native owner and unwind parked frames", async t => {
	const root = await mkdtemp(join(tmpdir(), "wit-peer-turns-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const fixtures = resolve("tests/fixtures/static-host-workers");
	const args = ["-std=gnu11", "-Wall", "-Wextra", "-Werror", "-pthread"
		, "-I" + resolve("src/backends/wit")];
	const cc = process.env.CC ?? "cc", libs = [];
	for(const tag of [10, 20])
	{
		const lib = join(root, tag + ".so");
		await run(cc, [...args, "-shared", "-fPIC", "-DPEER_TAG=" + tag
			, join(fixtures, "peer-turn-package.c"), "-o", lib]);
		libs.push(lib);
	}
	const exe = join(root, "run");
	await run(cc, [...args, join(fixtures, "peer-turn-runner.c"), "-ldl", "-o", exe]);
	const result = await run(exe, libs, { cwd: root, timeout: 15000 });
	assert.equal(result.stdout.trim(), "two dispatchers; both nested orders; four parked frames unwound");
	assert.equal(result.stderr, "");
});

test("two WIT packages share one bounded wait without consuming peer notifications", async t => {
	const root = await mkdtemp(join(tmpdir(), "wit-peer-wait-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const flags = ["-std=gnu11", "-Wall", "-Wextra", "-Werror"
		, "-I" + resolve("src/backends/wit")];
	const exe = join(root, "wait");
	await run(process.env.CC ?? "cc", [...flags, resolve("tests/fixtures/static-host-workers/peer-wait.c"), "-o", exe]);
	await run(exe, [], { timeout: 10000 });
});
