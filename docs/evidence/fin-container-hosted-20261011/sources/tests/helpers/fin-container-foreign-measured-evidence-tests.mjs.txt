/**
 * Authenticate the original measured installed matrix and retain its full report checks.
 * The archived runs are local glibc 2.36 executions, not hosted CI observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertFinForeignReport } from "./fin-container-foreign-report.mjs";

const directory = "docs/evidence/fin-container-foreign-measured-20261010";
const indexSha256 = "e92626c5485297165da79fa6203426ac28e2d8cd171f91c6e4f037dfcf269212";
const revision = "3ca155faffbe5ee9ea2a491bf28728579c10f2d5";
const expected = [
	["c-cpp", ["c", "cpp"]]
	, ["python311", ["python"], "3.11"]
	, ["python312", ["python"], "3.12"]
	, ["rust", ["rust"]]
	, ["dotnet", ["dotnet"]]
	, ["ruby", ["ruby"]]
	, ["php-native", ["php-native"]]
	, ["java-kotlin", ["java", "kotlin"]]
	, ["wit-wasi", ["wit-wasi"]]
];
const archived = name => readFile(join(directory, name));
const readIndex = async () => {
	const bytes = await archived("index.json");
	assert.equal(sha256(bytes), indexSha256, "The original matrix index must not change");
	const index = JSON.parse(bytes);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "native-fin-container-foreign-measured");
	assert.deepEqual(index.producer, { revision, tree: "5f134ce33487fdc2e80aa34f5937137751a90437", glibcFloor: "2.36", hosted: false });
	assert.deepEqual(index.runs.map(run => [run.label, run.profiles, ...(run.python ? [run.python] : [])]), expected);
	assert.equal(new Set(index.files.map(file => file.path)).size, index.files.length);
	assert.equal(index.files.length, 882);
	return index;
};
const authenticate = async (file, read = archived) => {
	assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes(".."));
	const bytes = await read(file.path);
	assert.deepEqual([bytes.length, sha256(bytes)], [file.bytes, file.sha256], file.path);
	return bytes;
};

test("the measured foreign-carrier archive retains every original run record and producer source snapshot", async t => {
	const index = await readIndex();
	for(const file of index.files) await authenticate(file);
	for(const [label] of expected)
		for(const name of ["runner.mjs.txt", "start.json", "end.json", "run.tap", "verified.json", "report.json"])
			assert.equal(index.files.filter(file => file.path === `${label}/${name}`).length, 1);
	const snapshots = index.files.filter(file => file.path.startsWith("sources/"));
	assert.equal(snapshots.length, 827);
	for(const file of snapshots) assert.equal(file.original, `git:${revision}:${file.path.slice("sources/".length, -".txt".length)}`);
	for(const path of [
		"tests/fixtures/onboarding/native-fin-containers/FinContainers.lean"
		, "tests/fixtures/fin-container-edges.lean"
		, "tests/helpers/fin-container-edge-install.mjs"
		, "tests/helpers/fin-container-edge-report.mjs"
		, "tests/helpers/fin-container-edge-report-hosts.mjs"
		, "tests/fixtures/fin-container-foreign-carriers.c"
		, "tests/helpers/fin-container-foreign-observer.mjs"
		, "tests/helpers/fin-container-foreign-report.mjs"
		, "scripts/check-fin-container-foreign-report.mjs"
		, "src/build/canonical-build.mjs"
	]) assert.ok(snapshots.some(file => file.path === `sources/${path}.txt`), path);
	t.diagnostic(`${index.files.length} original files, including ${snapshots.length} Git source snapshots, authenticated`);
});

test("all archived foreign-carrier selections pass the strict raw, public and foreign report gate", async () => {
	const index = await readIndex();
	for(const run of index.runs)
	{
		const get = async name => {
			const file = index.files.find(file => file.path === `${run.label}/${name}`);
			assert.ok(file); return authenticate(file);
		};
		const reportBytes = await get("report.json"), report = JSON.parse(reportBytes);
		const start = JSON.parse(await get("start.json")), end = JSON.parse(await get("end.json"));
		const verified = JSON.parse(await get("verified.json")), tap = await get("run.tap");
		assert.equal(start.revision, revision); assert.equal(start.tree, index.producer.tree);
		assert.equal(start.environment.LEAN_BRIDGE_FIN_CONTAINER_EDGE_PROFILES, run.profiles.join(","));
		assert.equal(start.environment.LEAN_BRIDGE_FIN_CONTAINER_EDGE_DISPATCH, "1");
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		assert.equal(start.report, verified.report); assert.equal(verified.revision, revision);
		assert.equal(start.report, start.environment.LEAN_BRIDGE_FIN_CONTAINER_EDGE_REPORT);
		assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
		assert.deepEqual([end.code, end.signal, end.stoppedForDisk], [0, null, false]);
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assert.equal(verified.reportSha256, sha256(reportBytes)); assert.equal(run.reportSha256, verified.reportSha256);
		assert.equal(verified.checker, `Fin container raw, public and foreign-carrier measurements verified for ${run.profiles.join(", ")}.`);
		assert.ok(Date.parse(start.startedAt) <= Date.parse(end.endedAt));
		assert.ok(Date.parse(end.endedAt) <= Date.parse(verified.verifiedAt));
		for(const [name, expected] of [["tests", 1], ["pass", 1], ["fail", 0], ["skipped", 0]])
			assert.equal(Number(tap.toString().match(new RegExp(`^# ${name} (\\d+)$`, "m"))?.[1]), expected);
		await assertFinForeignReport(report, run.profiles, { python: run.python });
		assert.deepEqual(run.observations, report.reports.map(item => ({
			profile: item.profile, checks: item.checks
			, sourceTreeSha256: item.sourceTreeSha256
			, consumerSha256: item.consumerSha256
			, fixtureSha256: item.fixtureSha256, modelSha256: item.modelSha256
			, foreignCalls: item.foreignCarriers.measuredCalls
			, foreignCases: item.foreignCarriers.cases
			, foreignStdoutSha256: item.foreignCarriers.stdoutSha256
		})));
	}
});

test("foreign-carrier archive authentication rejects altered reports, logs, runners and source bytes", async () => {
	const index = await readIndex();
	for(const [label] of expected)
		for(const name of ["report.json", "start.json", "end.json", "verified.json", "run.tap", "runner.mjs.txt"])
		{
			const file = index.files.find(file => file.path === `${label}/${name}`);
			const bytes = await archived(file.path);
			await assert.rejects(authenticate(file, async () => Buffer.concat([bytes, Buffer.from("\n")])), assert.AssertionError);
		}
	const file = index.files.find(file => file.path === "sources/tests/fixtures/fin-container-edges.lean.txt");
	const changed = Buffer.from(await archived(file.path)); changed[0] ^= 1;
	await assert.rejects(authenticate(file, async () => changed), assert.AssertionError);
});
