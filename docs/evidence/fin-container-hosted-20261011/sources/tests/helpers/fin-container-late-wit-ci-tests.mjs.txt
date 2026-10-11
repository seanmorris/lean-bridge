/**
 * Exercise WIT CI shell failure propagation with a stand-in producer, not a Lean package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-late-wit-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	await writeFile(join(bin, "node"), `#!/usr/bin/env bash
set -eu
printf '%s|%s|%s\\n' "\${LEAN_BRIDGE_FIN_LATE_WIT_TEST-}" "\${LEAN_BRIDGE_FIN_LATE_WIT_OUTPUT-}" "$*" >> "$PROBE_ROOT/calls"
if [[ $1 == --test ]]; then
  printf '%s\\n' 'synthetic WIT producer transcript'
  exit "\${PRODUCER_CODE:-0}"
fi
exit "\${CHECKER_CODE:-0}"
`);
	await chmod(join(bin, "node"), 0o755);
	return { root
		, run: (args = [], overrides = {}) => spawnSync("/usr/bin/bash"
			, [resolve("scripts/run-fin-late-wit-ci.sh"), ...args]
			, { cwd: root, encoding: "utf8", env: { PATH: `${bin}:/usr/bin:/bin`, PROBE_ROOT: root, ...overrides } }) };
};

test("WIT late-input CI shell requires fresh explicit installed output and the hosted floor", async t => {
	const { root, run } = await fixture(t);
	for(const args of [["extra"], ["--glibc", "2.36"]]) assert.equal(run(args).status, 2);
	for(const value of ["", "2.36", "2.38"]) assert.equal(run([], { LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: value }).status, 2);
	assert.equal(run().status, 0);
	assert.deepEqual((await readFile(join(root, "calls"), "utf8")).trim().split("\n"), [
		"1|build/fin-late-wit-ci/records|--test --test-concurrency=1 --test-reporter=tap tests/helpers/fin-container-late-wit-installed-tests.mjs"
		, "||scripts/check-fin-late-wit-report.mjs --directory build/fin-late-wit-ci/records --tap build/fin-late-wit-ci/run.tap --glibc 2.38"
	]);
	assert.equal(await readFile(join(root, "build/fin-late-wit-ci/run.tap"), "utf8"), "synthetic WIT producer transcript\n");
	assert.notEqual(run().status, 0);
});

test("WIT late-input CI shell fails on either producer or checker failure", async t => {
	for(const overrides of [{ PRODUCER_CODE: "7" }, { CHECKER_CODE: "9" }])
	{
		const { root, run } = await fixture(t);
		assert.equal(run([], overrides).status, Number(Object.values(overrides)[0]));
		assert.equal((await readFile(join(root, "calls"), "utf8")).trim().split("\n").length, overrides.PRODUCER_CODE ? 1 : 2);
	}
});
