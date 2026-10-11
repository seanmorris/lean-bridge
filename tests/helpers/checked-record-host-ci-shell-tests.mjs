/**
 * Check CI shell selection, capture and failure propagation with stand-in tools.
 * These tests do not claim installed Lean or host execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { checkedRecordHostRoutes } from "./checked-record-native-fixture.mjs";

test("checked-record CI shell runs four routes in every lane and stops on producer or checker failure", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-ci-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const name of ["mkdir", "tee"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	const fakeNode = `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test');
const route = producer ? process.env.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_ROUTES : args[4];
const output = 'build/checked-record-ci/' + process.env.FAKE_LANE + '/' + route;
fs.appendFileSync('calls.log', JSON.stringify([producer ? 'producer' : 'checker', route]) + '\\n');
if (producer) {
  assert.equal(process.env.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_HOSTS, process.env.FAKE_PROFILES);
  assert.equal(process.env.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_OUTPUT, output + '/records');
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap', 'tests/helpers/checked-record-native-installed-tests.mjs']);
  fs.mkdirSync(output + '/records/' + route, {recursive:true});
  fs.writeFileSync(output + '/records/' + route + '/partial.json', 'original partial report');
  process.stdout.write('original producer stdout\\n');
  process.stderr.write('original producer stderr\\n');
  process.exit(route === 'reviewed-ir' ? Number(process.env.FAKE_PRODUCER_EXIT) : 0);
}
assert.deepEqual(args, ['scripts/check-checked-record-host-reports.mjs',
  '--profiles', process.env.FAKE_PROFILES, '--route', route, '--directory', output + '/records/' + route,
  '--tap', output + '/run.tap', '--glibc', '2.38', ...JSON.parse(process.env.FAKE_EXTRA)]);
process.exit(route === 'reviewed-ir' ? Number(process.env.FAKE_CHECKER_EXIT) : 0);
`;
	await writeFile(join(bin, "node"), fakeNode); await chmod(join(bin, "node"), 0o755);
	const original = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR"));
	const script = resolve("scripts/run-checked-record-host-ci.sh");
	let index = 0;
	for(const [lane, profiles, ...extra] of [
		["python311", "python", "--python", "3.11"]
		, ["python312", "python", "--python", "3.12"]
		, ["jvm", "java,kotlin"]
		, ["ruby", "ruby"]
		, ["rust", "rust"]
		, ["dotnet", "dotnet"]
		, ["php-native", "php-native"], ["wit-wasi", "wit-wasi"]
	]) for(const [producer, checker, expected] of [[0, 0, 0], [17, 0, 17], [0, 19, 19]])
	{
		const directory = join(root, String(index++)); await mkdir(directory);
			const env = {
				...original
				, PATH: bin
				, FAKE_LANE: lane
				, FAKE_PROFILES: profiles
				, FAKE_EXTRA: JSON.stringify(extra)
			, FAKE_PRODUCER_EXIT: String(producer), FAKE_CHECKER_EXIT: String(checker)
			, LEAN_BRIDGE_CHECKED_RECORD_NATIVE_ROUTES: "untrusted-override" };
		const result = spawnSync("/bin/bash", [script, lane], { cwd: directory, env, encoding: "utf8" });
		assert.equal(result.status, expected, result.stderr);
		const selected = expected ? checkedRecordHostRoutes.slice(0, 2) : checkedRecordHostRoutes;
		const expectedCalls = selected.flatMap(route => [["producer", route], ...producer && route === "reviewed-ir" ? [] : [["checker", route]]]);
		const calls = await readFile(join(directory, "calls.log"), "utf8");
		assert.deepEqual(calls.trim().split("\n").map(JSON.parse), expectedCalls);
		for(const route of selected)
		{
			const output = join(directory, "build/checked-record-ci", lane, route);
			const tap = await readFile(join(output, "run.tap"), "utf8");
			assert.ok(tap.includes("original producer stdout\n")); assert.ok(tap.includes("original producer stderr\n"));
			assert.equal(await readFile(join(output, "records", route, "partial.json"), "utf8"), "original partial report");
		}
		const again = spawnSync("/bin/bash", [script, lane], { cwd: directory, env, encoding: "utf8" });
		assert.notEqual(again.status, 0); assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
	}
	for(const [args, extra] of [
		[[], {}], [["unknown"], {}], [["rust", "extra"], {}], [["../escape"], {}]
		, [["perl"], {}]
		, [["python311"], { LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36" }]
		, [["rust"], { LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "" }]
	]) {
		const directory = join(root, String(index++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], { cwd: directory, env: { ...original, PATH: bin, ...extra }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
});
