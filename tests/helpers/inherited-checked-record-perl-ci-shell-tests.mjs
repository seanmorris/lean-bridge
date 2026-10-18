/**
 * Exercise selection, failure propagation, and stale-output refusal.
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
	inheritedCheckedRecordPerlCase, inheritedCheckedRecordPerlCases
} from "./inherited-checked-record-perl-ci-report.mjs";

test("inherited checked-record Perl CI runs every case and preserves failures", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-perl-ci-shell-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bin = join(root, "bin"); await mkdir(bin);
	for(const name of ["mkdir", "tee"])
		await symlink(`/usr/bin/${name}`, join(bin, name));
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
const route = process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_ROUTES;
const mode = process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_MODES;
const selected = route + "-" + mode;
const output = "build/inherited-checked-record-perl-ci/" + selected;
fs.appendFileSync("calls.log", JSON.stringify([producer ? "producer" : "checker", selected]) + "\\n");
if(producer) {
  assert.equal(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_TEST, "1");
  assert.equal(process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR, "2.38");
  assert.equal(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_MAX_LOAD, "8");
  assert.equal(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_OUTPUT, output + "/records");
  assert.equal(process.env.LEAN_NUM_THREADS, "1"); assert.equal(process.env.OMP_NUM_THREADS, "1");
  assert.equal(process.env.MAKEFLAGS, "-j1"); assert.equal(process.env.CMAKE_BUILD_PARALLEL_LEVEL, "1");
  const title = "installed inherited checked-record Perl packages reproduce and relocate " + route + " " + mode;
  assert.deepEqual(args, ["--test", "--test-concurrency=1", "--test-reporter=tap",
    "--test-name-pattern=^" + title + "$", "tests/helpers/inherited-checked-record-perl-installed-tests.mjs"]);
  fs.mkdirSync(output + "/records/" + route + "/" + mode, {recursive:true});
  fs.writeFileSync(output + "/records/" + route + "/" + mode + "/partial.json", "original partial record");
  process.stdout.write("original producer stdout\\n"); process.stderr.write("original producer stderr\\n");
  process.exit(selected === process.env.FAKE_FAIL_CASE ? Number(process.env.FAKE_PRODUCER_EXIT) : 0);
}
assert.deepEqual(args, ["scripts/check-inherited-checked-record-perl-ci.mjs",
  "--route", route, "--mode", mode, "--producer", "${"a".repeat(40)}",
  "--directory", output + "/records/" + route + "/" + mode,
  "--tap", output + "/run.tap", "--glibc", "2.38", "--max-load", "8"]);
process.stdout.write("{\\"accepted\\":true}\\n");
process.exit(selected === process.env.FAKE_FAIL_CASE ? Number(process.env.FAKE_CHECKER_EXIT) : 0);
`);
	await chmod(join(bin, "node"), 0o755);
	const blocked = [
		"LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR"
		, "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_TEST"
		, "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_ROUTES"
		, "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_MODES"
		, "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_OUTPUT"
		, "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_MAX_LOAD"
		, "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERLS"
	];
	const clean = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !blocked.includes(key)));
	const script = resolve("scripts/run-inherited-checked-record-perl-ci.sh");
	let index = 0;
	for(const failCase of inheritedCheckedRecordPerlCases)
		for(const [producer, checker, expected] of [
			[0, 0, 0], [17, 0, 17], [0, 19, 19]
		]) {
			const directory = join(root, String(index++));
			await mkdir(directory);
			const environment = {
				...clean, PATH: bin, FAKE_FAIL_CASE: failCase
				, FAKE_PRODUCER_EXIT: String(producer)
				, FAKE_CHECKER_EXIT: String(checker)
			};
			const result = spawnSync("/bin/bash", [script], {
				cwd: directory, env: environment, encoding: "utf8"
			});
			assert.equal(result.status, expected, result.stderr);
			const selected = expected ? inheritedCheckedRecordPerlCases.slice(
				0, inheritedCheckedRecordPerlCases.indexOf(failCase) + 1
			) : inheritedCheckedRecordPerlCases;
			const expectedCalls = selected.flatMap(name => [
				["producer", name]
				, ...producer && name === failCase ? [] : [["checker", name]]
			]);
			const calls = await readFile(join(directory, "calls.log"), "utf8");
			assert.deepEqual(calls.trim().split("\n").map(JSON.parse)
				, expectedCalls);
			for(const name of selected)
			{
				const { route, mode } = inheritedCheckedRecordPerlCase(name);
				const output = join(directory
					, "build/inherited-checked-record-perl-ci", name);
				const originalTap = await readFile(join(output, "run.tap"), "utf8");
				assert.ok(originalTap.includes("original producer stdout\n"));
				assert.ok(originalTap.includes("original producer stderr\n"));
				assert.equal(await readFile(join(output
					, `records/${route}/${mode}/partial.json`), "utf8")
				, "original partial record");
			}
			const again = spawnSync("/bin/bash", [script], {
				cwd: directory, env: environment, encoding: "utf8"
			});
			assert.notEqual(again.status, 0);
			assert.equal(await readFile(join(directory, "calls.log"), "utf8")
				, calls);
		}
	for(const [arguments_, extra] of [
		[["extra"], {}]
		, [[], { LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36" }]
		, ...blocked.slice(1).map(name => [[], { [name]: "untrusted" }])
	]) {
		const directory = join(root, String(index++)); await mkdir(directory);
		const result = spawnSync("/bin/bash", [script, ...arguments_], {
			cwd: directory, env: { ...clean, PATH: bin, ...extra }
			, encoding: "utf8"
		});
		assert.equal(result.status, 2);
		assert.deepEqual(await readdir(directory), []);
	}
});
