/**
 * Authenticate original Python 3.11/3.12 reviewed Subtype observations at their frozen producer.
 * Recorded absolute paths are provenance only and are never opened by this reader.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeHostRecords } from "./reviewed-subtype-host-report.mjs";

export const reviewedSubtypePythonRoot = "docs/evidence/reviewed-subtype-python-hosts-20261010";
export const reviewedSubtypePythonIndexSha256 = "8e7b279ecb100eca3701083bd3984d53e7d4b8cfefd9deb5379007441fd3a2b0";

/**
 * Check the immutable archive and both complete installed selections.
 *
 * @param read - Optional byte reader for independent archive-corruption controls.
 */
export const readReviewedSubtypePythonArchive = async (read = readFile) => {
	const indexBytes = await read(`${reviewedSubtypePythonRoot}/index.json`);
	assert.equal(sha256(indexBytes), reviewedSubtypePythonIndexSha256);
	const index = JSON.parse(indexBytes), files = new Map();
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.revision, "274b8685d25caebb422ac4d31be09c2948fef84c");
	assert.equal(index.failedRevision, "aa55d66542b4e173fc64ef0c0dee5aa6384ecb86");
	assert.deepEqual(index.scope, { profiles: ["python"]
		, python: ["3.11.16", "3.12.14"]
		, sourcePath: "reviewed-source", glibcFloor: "2.36"
		, dispatch: "not measured", packageBinariesRetained: false
		, completeToolchainClosure: false });
	assert.equal(index.artifacts.length, 53);
	for(const artifact of index.artifacts)
	{
		assert.match(artifact.path, /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/u);
		assert.ok(artifact.path.split("/").every(part => part !== "." && part !== ".."));
		assert.equal(files.has(artifact.path), false);
		const bytes = await read(`${reviewedSubtypePythonRoot}/${artifact.path}`);
		assert.equal(bytes.length, artifact.bytes, artifact.path);
		assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files.set(artifact.path, bytes);
	}
	assert.equal(index.sources.length, 15);
	for(const source of index.sources)
	{
		assert.equal(sha256(files.get(source.archive)), source.sha256);
		assert.equal(source.revision, source.archive.startsWith("failed-overload/") ? index.failedRevision : index.revision);
	}
	const reports = [];
	for(const [floor, version] of [["3.11", "3.11.16"], ["3.12", "3.12.14"]])
	{
		const report = await assertReviewedSubtypeHostRecords({ profiles: ["python"], python: floor, read: path => files.get(`${floor}/${path}`) });
		assert.equal(report.reports[0].pythonEnvironment.python, version);
		const start = JSON.parse(files.get(`${floor}/run.start.json`)), end = JSON.parse(files.get(`${floor}/run.end.json`));
		assert.equal(start.revision, index.revision);
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		assert.equal(start.environment.LEAN_BRIDGE_REVIEWED_SUBTYPE_HOSTS, "python");
		assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
		assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
		assert.equal(end.tapSha256, sha256(files.get(`${floor}/run.tap`)));
		assert.equal(start.runnerSha256, sha256(files.get("runner.mjs.txt")));
		const finished = JSON.parse(files.get(`${floor}/run.finished.json`));
		assert.equal(finished.revision, index.revision);
		assert.equal(finished.reportSha256, sha256(files.get(`${floor}/report.json`)));
		for(const [name, count] of [["tests", 1], ["pass", 1], ["fail", 0], ["skipped", 0]])
			assert.match(files.get(`${floor}/run.tap`).toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
		reports.push(report);
	}
	assert.deepEqual(reports[0].builds, reports[1].builds, "both Python floors use the same reproduced wheel");
	const failure = JSON.parse(files.get("failed-overload/run.end.json"));
	assert.equal(failure.code, 1); assert.equal(failure.stoppedForDisk, false);
	assert.equal(failure.tapSha256, sha256(files.get("failed-overload/run.tap")));
	assert.match(files.get("failed-overload/run.tap").toString(), /bindingIr\.declarations\[0\]\.overloadKey/u);
	assert.match(files.get("failed-overload/run.tap").toString(), /^# pass 0$/mu);
	assert.equal(JSON.parse(files.get("failed-overload/run.start.json")).revision, index.failedRevision);
	return { index, files, reports };
};
