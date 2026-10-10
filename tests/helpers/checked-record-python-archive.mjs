/**
 * Authenticate all eight checked-record Python executions and their original producer records.
 * Absolute producer paths are provenance only; readers never reopen them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertCheckedRecordHostRecords } from "./checked-record-native-records.mjs";

export const checkedRecordPythonRoot = "docs/evidence/checked-record-python-hosts-20261010";
export const checkedRecordPythonIndexSha256 = "ed3430414be55f41b66c03192d038176c7ead292c724045a34436fc0885edd97";
export const checkedRecordPythonRevision = "5a730e4a970ee43485553b6357ae68e4fbfab827";
const routes = ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"];

/**
 * Authenticate original bytes first, then check each independently specified installed selection.
 *
 * @param read - Byte reader replaced only by archive-corruption controls.
 */
export const readCheckedRecordPythonArchive = async (read = readFile) => {
	const indexBytes = await read(`${checkedRecordPythonRoot}/index.json`);
	assert.equal(sha256(indexBytes), checkedRecordPythonIndexSha256);
	const index = JSON.parse(indexBytes), files = new Map();
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.revision, checkedRecordPythonRevision);
	assert.equal(index.tree, "461c77685201e562a7396961a99b992940028113");
	assert.deepEqual(index.scope, { profiles: ["python"]
		, python: ["3.11.16", "3.12.14"], routes
		, glibcFloor: "2.36", dispatch: "not measured"
		, packageBinariesRetained: false, completeToolchainClosure: false });
	assert.equal(index.artifacts.length, 168);
	for(const artifact of index.artifacts)
	{
		assert.match(artifact.path, /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/u);
		assert.ok(artifact.path.split("/").every(part => part !== "." && part !== ".."));
		assert.equal(files.has(artifact.path), false);
		const bytes = await read(`${checkedRecordPythonRoot}/${artifact.path}`);
		assert.equal(bytes.length, artifact.bytes, artifact.path);
		assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files.set(artifact.path, bytes);
	}
	assert.equal(index.sources.length, 21);
	assert.equal(new Set(index.sources.map(item => item.path)).size, 21);
	for(const source of index.sources)
	{
		assert.equal(source.revision, index.revision);
		assert.equal(source.archive, `sources/${source.path}.txt`);
		assert.equal(sha256(files.get(source.archive)), source.sha256);
	}
	assert.deepEqual(index.runs.map(run => [run.floor, run.version, run.route, run.archive]),
		[["3.11", "3.11.16"], ["3.12", "3.12.14"]].flatMap(([floor, version]) => routes.map(route => [floor, version, route, `${floor}/${route}`])));
	const reports = [];
	for(const run of index.runs)
	{
		const { archive, route, floor, version } = run;
		const report = await assertCheckedRecordHostRecords({ profiles: ["python"], route, python: floor, read: path => files.get(`${archive}/${path}`) });
		assert.equal(report.reports[0].pythonEnvironment.python, version);
		const start = JSON.parse(files.get(`${archive}/run.start.json`)), end = JSON.parse(files.get(`${archive}/run.end.json`));
		assert.equal(start.revision, index.revision); assert.equal(start.tree, index.tree);
		assert.equal(start.route, route); assert.equal(start.runnerSha256, sha256(files.get("runner.mjs.txt")));
		assert.equal(start.command, "/usr/bin/taskset");
		assert.deepEqual(start.args, ["-c", "3", "/usr/bin/node", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/checked-record-native-installed-tests.mjs"]);
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_HOSTS, "python");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_ROUTES, route);
		assert.equal(start.environment.LEAN_BRIDGE_PYTHON, `/app/.toolchains/python${floor.replace(".", "")}/bin/python3`);
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_OUTPUT, start.output);
		assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
		assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
		assert.equal(end.tapSha256, sha256(files.get(`${archive}/run.tap`)));
		const finished = JSON.parse(files.get(`${archive}/run.finished.json`));
		assert.equal(finished.revision, index.revision); assert.equal(finished.output, start.output);
		assert.equal(finished.reportSha256, sha256(files.get(`${archive}/report.json`)));
		for(const [name, count] of [["tests", 1], ["pass", 1], ["fail", 0], ["skipped", 0]])
			assert.match(files.get(`${archive}/run.tap`).toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
		reports.push(report);
	}
	for(let index = 0; index < 4; index++)
		assert.deepEqual(reports[index].builds, reports[index + 4].builds, "Both Python floors use the same two-root reproduced package for each route");
	return { index, files, reports };
};
