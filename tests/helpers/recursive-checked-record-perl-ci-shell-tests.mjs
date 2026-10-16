/**
 * Exercise closed case selection and failure propagation in the hosted recursive Perl runner.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { recursiveCheckedRecordPerlCases } from "./recursive-checked-record-perl-ci-report.mjs";

test("recursive checked-record Perl CI runs every case and preserves failures", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-record-perl-ci-shell-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const name of ["mkdir", "tee"]) await symlink(`/usr/bin/${name}`, join(bin, name));
	await writeFile(join(bin, "git"), `#!${process.execPath}
import assert from "node:assert/strict";
assert.deepEqual(process.argv.slice(2), ["rev-parse", "HEAD"]);
process.stdout.write("${"a".repeat(40)}\\n");
`);
	await chmod(join(bin, "git"), 0o755);
	await writeFile(join(bin, "node"), `#!${process.execPath}
import assert from "node:assert/strict";
import fs from "node:fs";
const args = process.argv.slice(2), producer = args.includes("--test");
const route = process.env.LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_ROUTES;
const fixture = process.env.LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_FIXTURES;
const selected = producer ? route + "-" + fixture : args[args.indexOf("--name") + 1];
const output = "build/recursive-checked-record-perl-ci/" + selected;
fs.appendFileSync("calls.log", JSON.stringify([producer ? "producer" : "checker", selected]) + "\\n");
if(producer) {
  assert.equal(process.env.LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_TEST, "1");
  assert.equal(process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR, "2.38");
  assert.equal(process.env.LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_MAX_LOAD, "8");
  assert.equal(process.env.LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_OUTPUT, output + "/records");
  assert.equal(process.env.LEAN_NUM_THREADS, "1"); assert.equal(process.env.OMP_NUM_THREADS, "1");
  assert.equal(process.env.MAKEFLAGS, "-j1"); assert.equal(process.env.CMAKE_BUILD_PARALLEL_LEVEL, "1");
  const title = "installed recursive checked-record Perl packages reproduce and relocate " + route + " " + fixture;
  assert.deepEqual(args, ["--test", "--test-concurrency=1", "--test-reporter=tap",
    "--test-name-pattern=^" + title + "$", "tests/helpers/recursive-checked-record-perl-installed-tests.mjs"]);
  fs.mkdirSync(output + "/records/" + route + "/" + fixture, {recursive:true});
  fs.writeFileSync(output + "/records/" + route + "/" + fixture + "/partial.json", "original partial record");
  process.stdout.write("original producer stdout\\n"); process.stderr.write("original producer stderr\\n");
  process.exit(selected === process.env.FAKE_FAIL_CASE ? Number(process.env.FAKE_PRODUCER_EXIT) : 0);
}
assert.deepEqual(args, ["scripts/check-recursive-checked-record-perl-ci.mjs",
  "--name", selected, "--producer", "${"a".repeat(40)}",
  "--directory", output + "/records/" + route + "/" + fixture, "--tap", output + "/run.tap",
  "--glibc", "2.38", "--max-load", "8"]);
process.stdout.write("{\\"accepted\\":true}\\n");
process.exit(selected === process.env.FAKE_FAIL_CASE ? Number(process.env.FAKE_CHECKER_EXIT) : 0);
`);
	await chmod(join(bin, "node"), 0o755);
	const blocked = [
		"LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR"
		, "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_TEST"
		, "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_ROUTES"
		, "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_FIXTURES"
		, "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_OUTPUT"
		, "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_MAX_LOAD"
		, "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERLS"
	];
	const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !blocked.includes(key)));
	const script = resolve("scripts/run-recursive-checked-record-perl-ci.sh"); let index = 0;
	for(const failCase of recursiveCheckedRecordPerlCases)
		for(const [producer, checker, expected] of [[0, 0, 0], [17, 0, 17], [0, 19, 19]])
		{
			const directory = join(root, String(index++)); await mkdir(directory);
			const env = { ...clean, PATH: bin, FAKE_FAIL_CASE: failCase
				, FAKE_PRODUCER_EXIT: String(producer)
				, FAKE_CHECKER_EXIT: String(checker) };
			const result = spawnSync("/bin/bash", [script], { cwd: directory, env, encoding: "utf8" });
			assert.equal(result.status, expected, result.stderr);
			const selected = expected ? recursiveCheckedRecordPerlCases.slice(0
				, recursiveCheckedRecordPerlCases.indexOf(failCase) + 1) : recursiveCheckedRecordPerlCases;
			const expectedCalls = selected.flatMap(name => [
				["producer", name]
				, ...producer && name === failCase ? [] : [["checker", name]]
			]);
			const calls = await readFile(join(directory, "calls.log"), "utf8");
			assert.deepEqual(calls.trim().split("\n").map(JSON.parse), expectedCalls);
			for(const name of selected)
			{
				const output = join(directory, "build/recursive-checked-record-perl-ci", name);
				const tap = await readFile(join(output, "run.tap"), "utf8");
				assert.ok(tap.includes("original producer stdout\n"));
				assert.ok(tap.includes("original producer stderr\n"));
				const [route, fixture] = name.split("-");
				assert.equal(await readFile(join(output
					, `records/${route}/${fixture}/partial.json`), "utf8")
					, "original partial record");
			}
			const again = spawnSync("/bin/bash", [script], { cwd: directory, env, encoding: "utf8" });
			assert.notEqual(again.status, 0); assert.equal(await readFile(join(directory, "calls.log"), "utf8"), calls);
		}
	for(const [args, extra] of [
		[["extra"], {}], [[], { LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36" }]
		, ...blocked.slice(1).map(name => [[], { [name]: "untrusted" }])
	]) {
		const directory = join(root, String(index++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...args], {
			cwd: directory, env: { ...clean, PATH: bin, ...extra }, encoding: "utf8"
		});
		assert.equal(result.status, 2); assert.deepEqual(await readdir(directory), []);
	}
});
