/**
 * Execute the CI shell with stand-in tools to check selection, capture and failure propagation.
 * These controls do not claim Lean compilation or installed package execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedSubtypeHostCiTestName, reviewedSubtypePerlConfigurations } from "./reviewed-subtype-host-ci-report.mjs";

const script = resolve("scripts/run-reviewed-subtype-host-ci.sh");
const cases = [
	["python311", "python", "--python", "3.11"]
	, ["python312", "python", "--python", "3.12"]
	, ["jvm", "java,kotlin"], ["rust", "rust"], ["dotnet", "dotnet"]
	, ["ruby", "ruby"], ["php-native", "php-native"], ["wit-wasi", "wit-wasi"]
	, ...reviewedSubtypePerlConfigurations.map(value => ["perl-" + value, "perl", "--perl", value])
];

test("native reviewed CI shell runs every lane, keeps original streams and propagates producer/checker failures", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-subtype-ci-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const name of ["mkdir", "tee"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	const fakeNode = `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test');
fs.appendFileSync('calls.log', (producer ? 'producer' : 'checker') + '\\n');
const output = 'build/reviewed-subtype-ci/' + process.env.FAKE_LANE;
if (producer) {
  assert.equal(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_HOSTS, process.env.FAKE_PROFILES);
  assert.equal(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_HOST_OUTPUT, output + '/records');
  assert.ok(args.includes('--test-concurrency=1'));
  assert.ok(args.includes('--test-reporter=tap'));
  assert.ok(args.includes('--test-name-pattern=^${reviewedSubtypeHostCiTestName}$'));
  assert.equal(args.at(-1), 'tests/helpers/reviewed-subtype-host-installed-tests.mjs');
  fs.mkdirSync(output + '/records');
  fs.writeFileSync(output + '/records/partial.json', 'original partial report');
  process.stdout.write('original producer stdout\\n');
  process.stderr.write('original producer stderr\\n');
  process.exit(Number(process.env.FAKE_PRODUCER_EXIT));
}
assert.deepEqual(args, ['scripts/check-reviewed-subtype-host-reports.mjs',
  '--profiles', process.env.FAKE_PROFILES, '--directory', output + '/records',
  '--tap', output + '/run.tap', '--glibc', '2.38', ...JSON.parse(process.env.FAKE_EXTRA)]);
process.exit(Number(process.env.FAKE_CHECKER_EXIT));
`;
	await writeFile(join(bin, "node"), fakeNode); await chmod(join(bin, "node"), 0o755);
	const original = Object.fromEntries(Object.entries(process.env).filter(([key]) => !["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR"].includes(key)));
	let index = 0;
	for(const [lane, profiles, ...extra] of cases)
		for(const [producer, checker, expected] of [[0, 0, 0], [17, 0, 17], [0, 19, 19]])
		{
			const directory = join(root, String(index++)); await mkdir(directory);
			const env = { ...original, PATH: bin, FAKE_LANE: lane, FAKE_PROFILES: profiles, FAKE_EXTRA: JSON.stringify(extra), FAKE_PRODUCER_EXIT: String(producer), FAKE_CHECKER_EXIT: String(checker) };
			const result = spawnSync("/bin/bash", [script, lane], { cwd: directory, env, encoding: "utf8" });
			assert.equal(result.status, expected, result.stderr);
			assert.equal(await readFile(join(directory, "calls.log"), "utf8"), producer ? "producer\n" : "producer\nchecker\n");
			const path = join(directory, "build/reviewed-subtype-ci", lane), tap = await readFile(join(path, "run.tap"), "utf8");
			assert.ok(tap.includes("original producer stdout\n")); assert.ok(tap.includes("original producer stderr\n"));
			assert.equal(await readFile(join(path, "records/partial.json"), "utf8"), "original partial report");
			const again = spawnSync("/bin/bash", [script, lane], { cwd: directory, env, encoding: "utf8" });
			assert.notEqual(again.status, 0); assert.equal(await readFile(join(path, "run.tap"), "utf8"), tap);
			assert.equal(await readFile(join(directory, "calls.log"), "utf8"), producer ? "producer\n" : "producer\nchecker\n");
		}
	for(const [args, extra] of [
		[[], {}], [["unknown"], {}], [["rust", "extra"], {}]
		, [["../escape"], {}]
		, [["python311"], { LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36" }]
		, [["perl-5.36.3-threaded"], { LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "" }]]) {
		const directory = join(root, String(index++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], { cwd: directory, env: { ...original, PATH: bin, ...extra }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
		}
});
