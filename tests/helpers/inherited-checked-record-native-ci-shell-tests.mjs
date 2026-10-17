/**
 * Exercise the real inherited native CI shell with stand-in tools.
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

const script = resolve("scripts/run-inherited-checked-record-native-ci.sh");
const selections = ["ordinary-full", "reviewed-full", "ordinary-result-only"
	, "reviewed-result-only"];

test("inherited native CI runs all selections and preserves producer failures", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-native-ci-shell-"));
	t.after(() => rm(root, { recursive: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const name of ["mkdir", "tee"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	await writeFile(join(bin, "git"), `#!/bin/bash
if [[ "$*" != 'rev-parse HEAD' ]]; then exit 99; fi
printf '%s\n' '${"a".repeat(40)}'
`);
	await chmod(join(bin, "git"), 0o755);
	await writeFile(join(bin, "node"), `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test');
for (const key of ['LEAN_NUM_THREADS', 'OMP_NUM_THREADS', 'CMAKE_BUILD_PARALLEL_LEVEL']) assert.equal(process.env[key], '1');
assert.equal(process.env.MAKEFLAGS, '-j1');
const route = process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_ROUTES;
const mode = process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_MODES;
assert.ok(['ordinary', 'reviewed'].includes(route));
assert.ok(['full', 'result-only'].includes(mode));
assert.equal(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_TEST, '1');
assert.equal(process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, '2.38');
assert.equal(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_MAX_LOAD, '12');
const selection = route + '-' + mode;
const output = 'build/inherited-checked-record-native-ci/' + selection;
assert.equal(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_OUTPUT, output + '/records');
const call = selection + '/' + (producer ? 'producer' : 'checker');
fs.appendFileSync('calls.log', call + '\\n');
if (producer) {
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap',
    '--test-name-pattern=^installed inherited checked-record native packages reproduce and relocate ' + route + ' ' + mode + '$',
    'tests/helpers/inherited-checked-record-native-installed-tests.mjs']);
  fs.mkdirSync(output + '/records');
  fs.writeFileSync(output + '/records/partial.json', 'original ' + selection);
  process.stdout.write('original ' + selection + ' stdout\\n');
  process.stderr.write('original ' + selection + ' stderr\\n');
} else {
  assert.deepEqual(args, ['scripts/check-inherited-checked-record-native-ci.mjs', '--route', route,
    '--mode', mode, '--producer', 'a'.repeat(40), '--directory', output + '/records/' + route + '/' + mode,
    '--tap', output + '/run.tap', '--glibc', '2.38', '--max-load', '12']);
  process.stdout.write('checked ' + selection + '\\n');
}
if (process.env.FAKE_FAIL === call) process.exit(17);
`);
	await chmod(join(bin, "node"), 0o755);
	const base = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("LEAN_BRIDGE_")));
	const order = selections.flatMap(selection => [
		selection + "/producer", selection + "/checker"
	]);
	let sequence = 0;
	for(const failure of ["none", ...order])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const env = { ...base, PATH: bin, FAKE_FAIL: failure };
		const result = spawnSync("/bin/bash", [script]
			, { cwd: directory, env, encoding: "utf8" });
		assert.equal(result.status, failure === "none" ? 0 : 17, result.stderr);
		const expected = failure === "none" ? order
			: order.slice(0, order.indexOf(failure) + 1);
		const calls = await readFile(join(directory, "calls.log"), "utf8");
		assert.equal(calls, expected.join("\n") + "\n");
		for(const call of expected)
		{
			const [selection, kind] = call.split("/");
			const output = join(directory, "build/inherited-checked-record-native-ci"
				, selection);
			if(kind === "checker") assert.equal(await readFile(
				join(output, "verification.json"), "utf8"), `checked ${selection}\n`);
			else
			{
				const tap = await readFile(join(output, "run.tap"), "utf8");
				assert.ok(tap.includes(`original ${selection} stdout\n`)
					&& tap.includes(`original ${selection} stderr\n`));
				assert.equal(await readFile(join(output, "records/partial.json"), "utf8")
					, "original " + selection);
			}
		}
		const again = spawnSync("/bin/bash", [script]
			, { cwd: directory, env, encoding: "utf8" });
		assert.notEqual(again.status, 0);
		assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
	}
	for(const name of ["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR"
		, ...["TEST", "PROFILES", "ROUTES", "MODES", "MAX_LOAD", "OUTPUT"]
			.map(name => "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_" + name)])
		for(const value of ["", "override"])
		{
			const directory = join(root, String(sequence++)); await mkdir(directory);
			const result = spawnSync("/bin/bash", [script]
				, { cwd: directory, env: { ...base, PATH: bin, [name]: value }
					, encoding: "utf8" });
			assert.equal(result.status, 2);
			assert.deepEqual(await readdir(directory), []);
		}
	for(const args of [["extra"], ["--glibc", "2.36"]])
	{
		const directory = join(root, String(sequence++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args]
			, { cwd: directory, env: { ...base, PATH: bin }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
	t.diagnostic("Nine complete/failing shell runs, stale-output refusal and closed override controls; stand-ins claim no compiled acceptance.");
});
