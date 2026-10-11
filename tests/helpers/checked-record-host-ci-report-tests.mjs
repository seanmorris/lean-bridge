/**
 * Check native checked-record CI arguments, actual installed TAP and archived execution records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseCheckedRecordHostCiArgs, assertCheckedRecordHostCiTap, assertCheckedRecordHostCiRecords } from "./checked-record-host-ci-report.mjs";
import { checkedRecordPythonRoot, readCheckedRecordPythonArchive } from "./checked-record-python-archive.mjs";
import { checkedRecordRubyJvmRoot, readCheckedRecordRubyJvmArchive } from "./checked-record-ruby-jvm-archive.mjs";
import { checkedRecordRemainingHostsRoot, readCheckedRecordRemainingHostsArchive } from "./checked-record-remaining-hosts-archive.mjs";

const args = ["--profiles", "python", "--route", "ordinary-source", "--directory", "records", "--tap", "run.tap", "--glibc", "2.36", "--python", "3.11"];

test("checked-record CI options require explicit profiles, route, floor and matching Python minor", () => {
	assert.deepEqual(parseCheckedRecordHostCiArgs(args), { profiles: ["python"], route: "ordinary-source", directory: "records", tap: "run.tap", glibc: "2.36", python: "3.11" });
	for(const invalid of [
		[]
		, args.slice(0, -1)
		, [...args, "--unknown", "x"]
		, [...args, "--profiles", "python"]
		, args.slice(0, -2)
		, args.toSpliced(0, 2)
		, args.toSpliced(2, 2)
		, args.toSpliced(8, 2)
		, args.with(1, "perl")
		, args.with(1, "python,python")
		, args.with(1, "java,kotlin")
		, args.with(3, "unknown")
		, args.with(5, "")
		, args.with(7, "--missing")
		, args.with(9, "2.39")
		, args.with(11, "3.13")
	]) assert.throws(() => parseCheckedRecordHostCiArgs(invalid));
});

test("checked-record CI TAP checks refuse missing, skipped, duplicate or differently selected installed tests", async () => {
	const tap = await readFile(`${checkedRecordPythonRoot}/3.11/ordinary-source/run.tap`, "utf8");
	assertCheckedRecordHostCiTap(tap, "ordinary-source");
	assert.throws(() => assertCheckedRecordHostCiTap(tap, "reviewed-ir"));
	assert.throws(() => assertCheckedRecordHostCiTap(tap, "unknown"));
	for(const change of [
		() => ""
		, source => source + "# fail 0\n"
		, source => source + "Bail out!\n"
		, source => source.replace(/^ok 1 - /mu, "not ok 1 - ")
		, source => source.replace(/^(ok 1 - .+)$/mu, "$1 # SKIP")
		, source => source.replace(/^(ok 1 - .+)$/mu, "$1 # TODO")
		, source => source.replace(/^# Subtest: .+\n/mu, "")
		, source => source.replace(/^ok 1 - .+\n/mu, "")
		, source => source.replace("# skipped 0", "# skipped 1")
		, source => source.replace("# cancelled 0", "# cancelled 1")
		, source => source.replace("# tests 1", "# tests 0")
		, source => source.replace("1..1", "1..0")
		, source => source.replaceAll("ordinary-source", "result-only-ordinary-source")
	]) assert.throws(() => assertCheckedRecordHostCiTap(change(tap), "ordinary-source"));
});

test("checked-record CI gate and CLI accept every archived route on both Python floors and all eight native hosts", async () => {
	let selections = 0;
	for(const [root, readArchive, profiles] of [
		[checkedRecordPythonRoot, readCheckedRecordPythonArchive, ["python"]]
		, [checkedRecordRubyJvmRoot, readCheckedRecordRubyJvmArchive, ["java", "kotlin", "ruby"]]
		, [checkedRecordRemainingHostsRoot, readCheckedRecordRemainingHostsArchive, ["dotnet", "php-native", "rust", "wit-wasi"]]
	]) {
		const { index, files } = await readArchive();
		for(const run of index.runs)
		{
			const directory = `${root}/${run.archive}`, tapPath = `${directory}/run.tap`;
			const options = {
				profiles
				, route: run.route
				, glibc: "2.36"
				, python: run.floor
				, tap: files.get(`${run.archive}/run.tap`).toString()
				, read: path => files.get(`${run.archive}/${path}`) };
			const report = await assertCheckedRecordHostCiRecords(options);
			assert.deepEqual(report.profiles, profiles);
			await assert.rejects(assertCheckedRecordHostCiRecords({ ...options, route: "unknown" }));
			await assert.rejects(assertCheckedRecordHostCiRecords({ ...options, read: () => { throw new Error("missing record"); } }));
			if(run.floor) await assert.rejects(assertCheckedRecordHostCiRecords({ ...options, python: run.floor === "3.11" ? "3.12" : "3.11" }));
			const result = spawnSync(process.execPath, ["scripts/check-checked-record-host-reports.mjs"
				, "--profiles"
				, profiles.join(",")
				, "--route"
				, run.route
				, "--directory"
				, directory
				, "--tap"
				, tapPath
				, "--glibc"
				, "2.36"
				, ...run.floor ? ["--python", run.floor] : []], { encoding: "utf8", timeout: 30_000 });
			assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
			assert.ok(result.stdout.startsWith(`Verified ${run.route}: `)); selections++;
		}
	}
	assert.equal(selections, 16);
});
