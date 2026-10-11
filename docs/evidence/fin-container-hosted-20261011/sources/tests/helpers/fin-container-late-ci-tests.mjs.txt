/**
 * Actual shell propagation with synthetic producers, not installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/run-fin-late-native-ci.sh");
const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-late-ci-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	const fake = join(bin, "node");
	await writeFile(fake, `#!/usr/bin/env bash
set -eu
printf '%s|%s|%s\\n' "\${LEAN_BRIDGE_FIN_LATE_PROFILES-}" "\${LEAN_BRIDGE_FIN_LATE_REPORT-}" "$*" >> "$PROBE_ROOT/calls"
if [[ $1 == --test ]]; then
  printf '%s\\n' 'synthetic producer transcript'
  exit "\${PRODUCER_CODE:-0}"
fi
exit "\${CHECKER_CODE:-0}"
`);
	await chmod(fake, 0o755);
	const env = { PATH: `${bin}:/usr/bin:/bin`, PROBE_ROOT: root };
	return { root, run: (args, overrides = {}) => spawnSync("/usr/bin/bash", [script, ...args], { cwd: root, env: { ...env, ...overrides }, encoding: "utf8" }) };
};

test("late-input CI shell selects all native lanes and keeps original producer output", async t => {
	const { root, run } = await fixture(t);
	const lanes = { "c-family": "c,cpp", python311: "python", python312: "python"
		, rust: "rust", ruby: "ruby", dotnet: "dotnet", jvm: "java,kotlin"
		, "php-native": "php-native" };
	for(const [lane, profiles] of Object.entries(lanes))
	{
		const outcome = run([lane]); assert.equal(outcome.status, 0, outcome.stderr);
		const lines = (await readFile(join(root, "calls"), "utf8")).trim().split("\n").slice(-2);
		assert.equal(lines[0], `${profiles}|build/fin-late-native-ci/${lane}/edges-${profiles.replaceAll(",", "-")}.json|--test --test-concurrency=1 --test-reporter=tap tests/helpers/fin-container-late-installed-tests.mjs`);
		assert.match(lines[1], /check-fin-late-native-report\.mjs/u); assert.ok(lines[1].includes(`--profiles ${profiles}`));
		assert.ok(lines[1].includes("--glibc 2.38"));
		if(lane.startsWith("python")) assert.ok(lines[1].endsWith(`--python ${lane === "python311" ? "3.11" : "3.12"}`));
		else assert.ok(!lines[1].includes("--python"));
		assert.equal(await readFile(join(root, "build/fin-late-native-ci", lane, "run.tap"), "utf8"), "synthetic producer transcript\n");
		assert.notEqual(run([lane]).status, 0, "refuse stale output");
	}
});

test("late-input CI shell propagates producer/checker failures and refuses unsafe selection", async t => {
	const { root, run } = await fixture(t);
	assert.equal(run(["rust"], { PRODUCER_CODE: "7" }).status, 7);
	assert.equal((await readFile(join(root, "calls"), "utf8")).trim().split("\n").length, 1, "no checker after failed producer");
	assert.equal(run(["ruby"], { CHECKER_CODE: "9" }).status, 9);
	for(const args of [[], ["unknown"], ["wit-wasi"], ["perl"], ["rust", "ruby"]]) assert.equal(run(args).status, 2);
	assert.equal(run(["dotnet"], { LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36" }).status, 2);
	assert.equal(run(["dotnet"], { LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "" }).status, 2);
});
