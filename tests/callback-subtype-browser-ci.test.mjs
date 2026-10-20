/**
 * Fail-closed controls for hosted callback Subtype browser acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	assertCallbackSubtypeBrowserTap
	, callbackSubtypeBrowserTestName
	, checkCallbackSubtypeBrowserCi
	, parseCallbackSubtypeBrowserCiArgs
} from "./helpers/callback-subtype-browser-ci.mjs";

const commit = "a".repeat(40);
const runtime = { node: process.version, platform: process.platform
	, arch: process.arch };
const tap = `TAP version 13
# Subtest: ${callbackSubtypeBrowserTestName}
ok 1 - ${callbackSubtypeBrowserTestName}
  ---
  duration_ms: 123.45
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 456.78
`;

test("callback Subtype browser report requires one terminal three-engine acceptance", () => {
	const options = { producer: commit, tap: "run.tap", runtime: "runtime.json" };
	assert.deepEqual(parseCallbackSubtypeBrowserCiArgs(Object.entries(options)
		.flatMap(([key, value]) => ["--" + key, value])), options);
	assertCallbackSubtypeBrowserTap(tap);
	assert.deepEqual(checkCallbackSubtypeBrowserCi(options, { tap, runtime }), {
		schemaVersion: 1, producerCommit: commit, runtime
		, routes: ["ordinary", "reviewed"]
		, profiles: ["browser-javascript", "browser-react", "browser-worker"]
		, engines: ["chromium", "firefox", "webkit"]
		, nodeAccepted: true, browserAccepted: true
	});
	for(const changed of [
		tap.replace("ok 1", "not ok 1")
		, tap.replace("# pass 1", "# pass 0")
		, tap.replace("# fail 0", "# fail 1")
		, tap.replace("# skipped 0", "# skipped 1")
		, tap.replace("ok 1 -", "ok 1 - # SKIP ")
		, tap.replace("1..1", "1..2")
	]) assert.throws(() => assertCallbackSubtypeBrowserTap(changed));
	for(const args of [[], ["--producer", commit], ["--unknown", "x", "--tap", "x", "--runtime", "x"], ["--producer", "short", "--tap", "x", "--runtime", "x"], ["--producer", commit, "--producer", commit, "--runtime", "x"]])
		assert.throws(() => parseCallbackSubtypeBrowserCiArgs(args));
	assert.throws(() => checkCallbackSubtypeBrowserCi(options, {
		tap, runtime: { ...runtime, extra: true }
	}));
});

test("callback Subtype browser workflow cannot narrow engines, routes or retained failures", async t => {
	const source = await readFile(".github/workflows/callback-subtype-browser.yml", "utf8");
	assert.ok(source.startsWith("name: Callback Subtypes in installed npm browser consumers\n"));
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "permissions:\n  contents: read\n"
		, "group: callback-subtype-browser-${{ github.ref }}"
		, "cancel-in-progress: true"
		, "runs-on: ubuntu-24.04"
		, "timeout-minutes: 240"
		, "uses: actions/checkout@v6"
		, "fetch-depth: 0"
		, "persist-credentials: false"
		, 'node-version: "22"'
		, "npm ci --ignore-scripts --no-audit --no-fund"
		, "bash scripts/install-playwright-browsers.sh chromium firefox webkit"
		, "nix build .#component-build-engine --out-link build/locked-lake-engine"
		, "bash scripts/build-lean-link-spike.sh"
		, 'bash scripts/run-callback-subtype-browser-ci.sh "$PWD/build/lean-link-spike/lazy"'
		, "if: always()"
		, "build/callback-subtype-browser-ci/"
		, "if-no-files-found: error"
		, "if: always() && steps.acceptance.outcome != 'success'"
		, "run: exit 1"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error:|strategy:|needs:|LEAN_BRIDGE_LAKE_RUNTIME_ROOT:/u);
	const mutations = [
		["  push:\n", ""], ["  pull_request:\n", ""]
		, ["contents: read", "contents: write"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ["chromium firefox webkit", "chromium"]
		, ["npm ci --ignore-scripts", "npm install"]
		, ["nix build .#component-build-engine", "true missing-engine"]
		, ["bash scripts/build-lean-link-spike.sh", "true missing-runtime"]
		, ["bash scripts/run-callback-subtype-browser-ci.sh", "true"]
		, ["if: always()\n", "if: success()\n"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unknown.outcome"]
		, ["run: exit 1", "run: exit 0"]
	];
	for(const [before, after] of mutations)
	{
		const changed = source.replace(before, after);
		assert.notEqual(changed, source);
		const stillValid = required => changed.includes(required);
		assert.equal([
			"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
			, "permissions:\n  contents: read\n"
			, "persist-credentials: false"
			, "bash scripts/install-playwright-browsers.sh chromium firefox webkit"
			, "npm ci --ignore-scripts --no-audit --no-fund"
			, "nix build .#component-build-engine --out-link build/locked-lake-engine"
			, "bash scripts/build-lean-link-spike.sh"
			, 'bash scripts/run-callback-subtype-browser-ci.sh "$PWD/build/lean-link-spike/lazy"'
			, "if: always()\n"
			, "if-no-files-found: error"
			, "if: always() && steps.acceptance.outcome != 'success'"
			, "run: exit 1"
		].every(stillValid), false, before);
	}
	t.diagnostic(`${mutations.length} workflow bypasses refused by mandatory-source controls.`);
});

test("callback Subtype browser CI shell pins its environment and preserves failures", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-callback-browser-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const command of ["mkdir", "tee", "cmp"])
		await symlink(`/usr/bin/${command}`, join(bin, command));
	const fakeNode = `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2);
for (const key of ['LEAN_NUM_THREADS','OMP_NUM_THREADS','EMCC_CORES','CMAKE_BUILD_PARALLEL_LEVEL']) assert.equal(process.env[key], '1');
assert.equal(process.env.MAKEFLAGS, '-j1');
assert.equal(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT, '/explicit/runtime');
assert.equal(process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_NPM_TEST, '1');
assert.equal(process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_BROWSER_TEST, '1');
assert.equal(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, 'chromium,firefox,webkit');
let phase;
if (args[0] === '-p') phase = fs.existsSync('build/callback-subtype-browser-ci/acceptance.tap') ? 'runtime-after' : 'runtime-before';
else if (args.includes('--test')) phase = 'acceptance';
else phase = 'checker';
fs.appendFileSync('calls.log', phase + '\\n');
if (phase.startsWith('runtime-')) process.stdout.write(JSON.stringify(${JSON.stringify(runtime)}) + '\\n');
else if (phase === 'acceptance') {
  assert.deepEqual(args, ['--test','--test-concurrency=1','--test-reporter=tap','--test-name-pattern=^${callbackSubtypeBrowserTestName}$','tests/callback-subtype-npm-browser.test.mjs']);
  process.stdout.write(${JSON.stringify(tap)});
} else {
  assert.deepEqual(args, ['scripts/check-callback-subtype-browser-ci.mjs','--producer','${commit}','--tap','build/callback-subtype-browser-ci/acceptance.tap','--runtime','build/callback-subtype-browser-ci/runtime-before.json']);
  process.stdout.write('{"accepted":true}\\n');
}
if (process.env.FAKE_FAIL === phase) process.exit(17);
`;
	await writeFile(join(bin, "node"), fakeNode); await chmod(join(bin, "node"), 0o755);
	await writeFile(join(bin, "git"), `#!/bin/bash\n[[ "$*" == 'rev-parse HEAD' ]] || exit 99\nprintf '%s\\n' '${commit}'\n`);
	await chmod(join(bin, "git"), 0o755);
	const script = resolve("scripts/run-callback-subtype-browser-ci.sh");
	const inherited = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("LEAN_BRIDGE_")));
	const env = { ...inherited, PATH: bin };
	for(const [index, failure] of ["none", "acceptance", "checker"].entries())
	{
		const directory = join(root, String(index)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, "/explicit/runtime"], {
			cwd: directory, env: { ...env, FAKE_FAIL: failure }, encoding: "utf8"
		});
		assert.equal(result.status, failure === "none" ? 0 : 17, result.stderr);
		const calls = (await readFile(join(directory, "calls.log"), "utf8")).trim().split("\n");
		assert.deepEqual(calls, failure === "acceptance"
			? ["runtime-before", "acceptance"]
			: ["runtime-before", "acceptance", "runtime-after", "checker"]);
		assert.equal(await readFile(join(directory, "build/callback-subtype-browser-ci/acceptance.tap"), "utf8"), tap);
		const again = spawnSync("/bin/bash", [script, "/explicit/runtime"], {
			cwd: directory, env, encoding: "utf8"
		});
		assert.notEqual(again.status, 0);
	}
	for(const [index, args] of [[], ["relative"], ["/explicit/runtime", "extra"]].entries())
	{
		const directory = join(root, "invalid-" + index); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], { cwd: directory, env, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	for(const variable of ["LEAN_BRIDGE_LAKE_RUNTIME_ROOT", "LEAN_BRIDGE_CALLBACK_SUBTYPE_NPM_TEST", "LEAN_BRIDGE_CALLBACK_SUBTYPE_BROWSER_TEST", "LEAN_BRIDGE_TYPE_CORPUS_BROWSERS"])
	{
		const directory = join(root, "preset-" + variable); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, "/explicit/runtime"], {
			cwd: directory, env: { ...env, [variable]: "preset" }, encoding: "utf8"
		});
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
});
