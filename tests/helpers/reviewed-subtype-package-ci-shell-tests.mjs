/**
 * Check the package CI shell's selection, stream capture and failure propagation.
 * Stand-in tools do not establish installed package support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedSubtypePackageTestNames } from "./reviewed-subtype-package-fixture.mjs";

test("reviewed package CI shell retains both streams, refuses stale output and propagates failures", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-package-ci-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"), script = resolve("scripts/run-reviewed-subtype-package-ci.sh"); await mkdir(bin);
	for(const name of ["mkdir", "tee"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	const fake = `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test');
const lane = process.env.FAKE_LANE, output = 'build/reviewed-subtype-package-ci/' + lane;
fs.appendFileSync('calls.log', (producer ? 'producer' : 'checker') + '\\n');
if (producer) {
  assert.equal(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_PACKAGE_RECORDS, output + '/records');
  assert.equal(process.env.LEAN_BRIDGE_LAKE_ENGINE, '/original/locked-engine');
  assert.equal(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT, '/original/runtime');
  if (lane === 'c-cpp') {
    assert.equal(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_PROFILES, 'c,cpp');
    assert.equal(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_REPORT, output + '/records/report.json');
  } else {
    assert.equal(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_NPM_TEST, '1');
    assert.equal(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_NPM_REPORT, output + '/records/report.json');
  }
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap',
    '--test-name-pattern=' + process.env.FAKE_PATTERN, 'tests/reviewed-subtype-installed.test.mjs']);
  fs.mkdirSync(output + '/records');
  fs.writeFileSync(output + '/records/partial.json', 'original partial record');
  process.stdout.write('original stdout\\n'); process.stderr.write('original stderr\\n');
  process.exit(Number(process.env.FAKE_PRODUCER_EXIT));
}
assert.deepEqual(args, ['scripts/check-reviewed-subtype-package-reports.mjs', '--lane', lane,
  '--directory', output + '/records', '--tap', output + '/run.tap']);
process.exit(Number(process.env.FAKE_CHECKER_EXIT));
`;
	await writeFile(join(bin, "node"), fake); await chmod(join(bin, "node"), 0o755);
	const original = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_")));
	let index = 0;
	for(const lane of ["c-cpp", "npm"]) for(const [producer, checker, expected] of [[0, 0, 0], [17, 0, 17], [0, 19, 19]])
	{
		const directory = join(root, String(index++)); await mkdir(directory);
		const pattern = "^" + reviewedSubtypePackageTestNames[lane].replaceAll("+", "\\+") + "$";
		const env = { ...original, PATH: bin, FAKE_LANE: lane
			, FAKE_PATTERN: pattern, FAKE_PRODUCER_EXIT: String(producer)
			, FAKE_CHECKER_EXIT: String(checker)
			, LEAN_BRIDGE_LAKE_ENGINE: "/original/locked-engine"
			, LEAN_BRIDGE_LAKE_RUNTIME_ROOT: "/original/runtime" };
		const result = spawnSync("/bin/bash", [script, lane], { cwd: directory, env, encoding: "utf8" });
		assert.equal(result.status, expected, result.stderr);
		const calls = producer ? "producer\n" : "producer\nchecker\n";
		assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
		const output = join(directory, "build/reviewed-subtype-package-ci", lane), tap = await readFile(join(output, "run.tap"), "utf8");
		assert.ok(tap.includes("original stdout\n")); assert.ok(tap.includes("original stderr\n"));
		assert.equal(await readFile(join(output, "records/partial.json"), "utf8"), "original partial record");
		const again = spawnSync("/bin/bash", [script, lane], { cwd: directory, env, encoding: "utf8" });
		assert.notEqual(again.status, 0); assert.equal(await readFile(join(output, "run.tap"), "utf8"), tap);
		assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
	}
	for(const [args, extra] of [
		[[], {}], [["unknown"], {}], [["../escape"], {}], [["npm", "extra"], {}]
		, [["c-cpp"], { LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36" }]
		, [["npm"], { LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "" }]]) {
		const directory = join(root, String(index++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], { cwd: directory, env: { ...original, PATH: bin, ...extra }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
		}
});
