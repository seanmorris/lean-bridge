/**
 * Authenticate original complete native late-input runs without promoting support or dispatch claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertFinLateReport, assertFinLateTap } from "./fin-container-late-report.mjs";

export const finLateNativeArchive = "docs/evidence/fin-container-late-native-20261011";
export const finLateNativeIndexSha256 = "3edacf6acd8bbdcf377b23871235d80d92c577fa121aa9c2f8046bcc4d0c3491";

/**
 * Check every archived byte and all eight complete native run selections.
 *
 * @param read - Repository-relative byte reader, injectable for corruption tests.
 */
export const readFinLateNativeArchive = async (read = readFile) => {
	const indexBytes = await read(`${finLateNativeArchive}/index.json`);
	assert.equal(sha256(indexBytes), finLateNativeIndexSha256);
	const index = JSON.parse(indexBytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "fin-container-late-native-archive-v1");
	assert.deepEqual(index.runs.map(run => [run.label, run.profiles, run.python ?? null]), [
		["c-family-r1", ["c", "cpp"], null]
		, ["python311-r2", ["python"], "3.11"]
		, ["python312-r1", ["python"], "3.12"]
		, ["ruby-r2", ["ruby"], null], ["rust-r2", ["rust"], null]
		, ["dotnet-r1", ["dotnet"], null]
		, ["jvm-r1", ["java", "kotlin"], null]
		, ["php-r2", ["php-native"], null]
	]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes(".."));
		assert.ok(!files.has(file.path));
		const bytes = await read(`${finLateNativeArchive}/${file.path}`);
		assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(file.path, bytes);
	}
	const json = path => JSON.parse(files.get(path));
	for(const run of index.runs)
	{
		const prefix = run.label + "/", start = json(prefix + "run.start.json"), end = json(prefix + "run.end.json");
		assert.equal(start.revision, run.revision); assert.match(run.revision, /^[a-f0-9]{40}$/u);
		assert.equal(start.environment.LEAN_BRIDGE_FIN_LATE_PROFILES, run.profiles.join(","));
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		assert.equal(start.command, "/usr/bin/taskset"); assert.deepEqual(start.args.slice(0, 2), ["-c", "3"]);
		assert.match(start.args[2], /^\/.+\/node$/u);
		assert.deepEqual(start.args.slice(3), ["--test", "--test-concurrency=1", "tests/helpers/fin-container-late-installed-tests.mjs"]);
		assert.equal(start.runnerSha256, sha256(files.get(prefix + "runner.mjs")));
		assert.ok(start.minimumMiB >= 2048); assert.ok(end.minimumMiB >= 768);
		assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
		const tap = files.get(prefix + "run.tap"); assert.equal(end.tapSha256, sha256(tap)); assertFinLateTap(tap.toString());
		const reportBytes = files.get(prefix + "report.json"), report = JSON.parse(reportBytes);
		await assertFinLateReport(report, run.profiles, { python: run.python, glibc: "2.36", read: async path => files.get(prefix + "records/" + path) });
		const controls = json(prefix + "mutations.json");
		assert.equal(controls.reportSha256, sha256(reportBytes)); assert.deepEqual(controls.profiles, run.profiles);
		assert.equal(controls.records, Object.keys(report.recordFiles).length);
		assert.equal(controls.rejectedControls, run.profiles.length * 26 + 2 * controls.records + 2);
		for(const source of index.files.filter(file => file.path.startsWith(prefix + "sources/")))
		{
			assert.equal(source.gitRevision, run.revision);
			assert.equal(source.path, prefix + "sources/" + source.gitPath + ".txt");
		}
	}
	assert.match(files.get("c-family-r1/queue.log").toString(), /AssertionError/u);
	const corrected = JSON.parse(files.get("c-family-check-r2.log"));
	assert.deepEqual(corrected, { profiles: ["c", "cpp"], checks: [21186, 20162], records: 19 });
	const failedStart = json("php-r1-failed/run.start.json"), failedEnd = json("php-r1-failed/run.end.json");
	assert.equal(failedStart.runnerSha256, sha256(files.get("php-r1-failed/runner.mjs")));
	assert.equal(failedEnd.tapSha256, sha256(files.get("php-r1-failed/run.tap")));
	assert.deepEqual([failedEnd.code, failedEnd.signal, failedEnd.diskStop], [1, null, false]);
	assert.match(files.get("php-r1-failed/run.tap").toString(), /ENOENT: no such file or directory, realpath '.+\/ctype\.so'/u);
	assert.throws(() => assertFinLateTap(files.get("php-r1-failed/run.tap").toString()));
	assert.equal(failedStart.environment.LEAN_BRIDGE_PHP, "/app/.toolchains/php-8.5.10-ffi/bin/php");
	assert.equal(json("php-r2/run.start.json").environment.LEAN_BRIDGE_PHP, "/usr/bin/php");
	return { index, files };
};
