/**
 * Check route selection, retained output and failure propagation using stand-in tools.
 * These tests do not claim new installed Lean or Perl execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { checkedRecordPerlRoutes } from "./checked-record-perl-fixture.mjs";

test("Perl checked-record CI runs every full matrix and preserves failures without weakening the floor", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-checked-ci-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const name of ["mkdir", "tee"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	const source = `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
const args = process.argv.slice(2), producer = args.includes('--test');
const route = producer ? process.env.LEAN_BRIDGE_CHECKED_RECORD_PERL_ROUTES : args[2];
const output = 'build/checked-record-perl-ci/' + route;
fs.appendFileSync('calls.log', JSON.stringify([producer ? 'producer' : 'checker', route]) + '\\n');
if (producer) {
  assert.equal(process.env.LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST, '1');
  assert.equal(process.env.LEAN_BRIDGE_CHECKED_RECORD_PERL_OUTPUT, output + '/records');
  assert.equal(process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR, undefined);
  assert.equal(process.env.LEAN_BRIDGE_CHECKED_RECORD_PERLS, undefined);
  assert.deepEqual(args, ['--test', '--test-concurrency=1', '--test-reporter=tap', 'tests/helpers/checked-record-perl-installed-tests.mjs']);
  fs.mkdirSync(output + '/records/' + route, {recursive:true});
  fs.writeFileSync(output + '/records/' + route + '/partial.json', 'original partial report');
  process.stdout.write('original producer stdout\\n');
  process.stderr.write('original producer stderr\\n');
  process.exit(route === process.env.FAKE_FAIL_ROUTE ? Number(process.env.FAKE_PRODUCER_EXIT) : 0);
}
assert.deepEqual(args, ['scripts/check-checked-record-perl-reports.mjs', '--route', route,
  '--directory', output + '/records/' + route, '--tap', output + '/run.tap', '--glibc', '2.38']);
process.exit(route === process.env.FAKE_FAIL_ROUTE ? Number(process.env.FAKE_CHECKER_EXIT) : 0);
`;
	await writeFile(join(bin, "node"), source); await chmod(join(bin, "node"), 0o755);
	const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !["LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_CHECKED_RECORD_PERLS"].includes(key)));
	const script = resolve("scripts/run-checked-record-perl-ci.sh"); let index = 0;
	for(const failRoute of checkedRecordPerlRoutes) for(const [producer, checker, expected] of [[0, 0, 0], [17, 0, 17], [0, 19, 19]])
	{
		const directory = join(root, String(index++)); await mkdir(directory);
		const env = { ...environment, PATH: bin, FAKE_FAIL_ROUTE: failRoute
			, FAKE_PRODUCER_EXIT: String(producer), FAKE_CHECKER_EXIT: String(checker)
			, LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST: "0"
			, LEAN_BRIDGE_CHECKED_RECORD_PERL_ROUTES: "untrusted"
			, LEAN_BRIDGE_CHECKED_RECORD_PERL_OUTPUT: "/untrusted"
		};
		const result = spawnSync("/bin/bash", [script], { cwd: directory, env, encoding: "utf8" });
		assert.equal(result.status, expected, result.stderr);
		const selected = expected ? checkedRecordPerlRoutes.slice(0, checkedRecordPerlRoutes.indexOf(failRoute) + 1) : checkedRecordPerlRoutes;
		const expectedCalls = selected.flatMap(route => [["producer", route], ...producer && route === failRoute ? [] : [["checker", route]]]);
		const calls = await readFile(join(directory, "calls.log"), "utf8");
		assert.deepEqual(calls.trim().split("\n").map(JSON.parse), expectedCalls);
		for(const route of selected)
		{
			const output = join(directory, "build/checked-record-perl-ci", route);
			const tap = await readFile(join(output, "run.tap"), "utf8");
			assert.ok(tap.includes("original producer stdout\n")); assert.ok(tap.includes("original producer stderr\n"));
			assert.equal(await readFile(join(output, "records", route, "partial.json"), "utf8"), "original partial report");
		}
		const again = spawnSync("/bin/bash", [script], { cwd: directory, env, encoding: "utf8" });
		assert.notEqual(again.status, 0); assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
	}
	for(const [args, extra] of [
		[["extra"], {}], [[], { LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36" }]
		, [[], { LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "" }]
		, [[], { LEAN_BRIDGE_CHECKED_RECORD_PERLS: "{}" }]
	]) {
		const directory = join(root, String(index++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], { cwd: directory, env: { ...environment, PATH: bin, ...extra }, encoding: "utf8" });
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
});
