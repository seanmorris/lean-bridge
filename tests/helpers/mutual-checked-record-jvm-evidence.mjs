/**
 * Authenticate every retained recursive checked-record Maven artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	mutualCheckedRecordJvmArchiveRoutes, mutualCheckedRecordJvmCheckerSources
	, mutualCheckedRecordJvmEvidence, mutualCheckedRecordJvmOriginal
	, mutualCheckedRecordJvmProducer, mutualCheckedRecordJvmProducerSources
} from "./mutual-checked-record-jvm-provenance.mjs";
import {
	checkMutualCheckedRecordJvmReport
} from "./mutual-checked-record-jvm-report.mjs";

export { mutualCheckedRecordJvmEvidence };
// Filled with the immutable index identity after the one-shot archive is committed.
export const mutualCheckedRecordJvmEvidenceSha256
	= "a8e00568597d7fbf4e9e917881863c2d25c9058b401dd4d7c697ddd39f3b854b";

const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_.+/@-]+(?:\/[A-Za-z0-9_.+@-]+)*$/u.test(path)
	&& !path.startsWith("/")
	&& path.split("/").every(part => part !== "." && part !== "..");
const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};

/**
 * Reconcile every retained byte, source snapshot and accepted execution.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkMutualCheckedRecordJvmEvidence = async (read = readFile) => {
	const indexPath = `${mutualCheckedRecordJvmEvidence}/index.json`;
	const indexBytes = Buffer.from(await read(indexPath));
	assert.equal(sha256(indexBytes), mutualCheckedRecordJvmEvidenceSha256);
	const index = json(indexBytes, indexPath), files = new Map();
	exactKeys(index, [
		"schemaVersion", "kind", "producerCommit", "archiveCommit", "runtime"
		, "runs", "sourceSnapshots", "limitations", "files"
	], "index keys");
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "mutual-checked-record-jvm-installed-v1");
	assert.equal(index.producerCommit, mutualCheckedRecordJvmProducer);
	assert.match(index.archiveCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(index.runtime, {
		node: "v22.23.2", platform: "linux", arch: "x64"
	});
	assert.ok(index.limitations.length === 6
		&& index.limitations.every(item => typeof item === "string" && item.length));
	let previous = "";
	for(const entry of index.files)
	{
		exactKeys(entry, ["path", "bytes", "sha256"], entry.path);
		assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
		assert.ok(!previous || previous.localeCompare(entry.path) < 0, entry.path);
		previous = entry.path;
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
		assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		const bytes = Buffer.from(await read(
			`${mutualCheckedRecordJvmEvidence}/${entry.path}`
		));
		assert.equal(bytes.length, entry.bytes, entry.path);
		assert.equal(sha256(bytes), entry.sha256, entry.path);
		files.set(entry.path, bytes);
	}
	const snapshots = [
		{ role: "producer", commit: mutualCheckedRecordJvmProducer
			, paths: mutualCheckedRecordJvmProducerSources() }
		, { role: "checker", commit: index.archiveCommit
			, paths: mutualCheckedRecordJvmCheckerSources(index.archiveCommit) }
	];
	assert.deepEqual(index.sourceSnapshots, snapshots);
	const expectedPaths = [];
	for(const snapshot of snapshots) for(const path of snapshot.paths)
	{
		const retained = `sources/${snapshot.role}/${path}`;
		assert.deepEqual(files.get(retained)
			, mutualCheckedRecordJvmOriginal(snapshot.commit, path), retained);
		expectedPaths.push(retained);
	}
	assert.deepEqual(index.runs.map(run => run.route)
		, mutualCheckedRecordJvmArchiveRoutes);
	const runs = [];
	for(const run of index.runs)
	{
		exactKeys(run, [
			"route", "recordCount", "reportSha256", "packages"
			, "runtimeIdentity", "bindingIrSha256", "layoutSha256"
			, "jdkVersion", "kotlinVersion", "results", "executions"
			, "independentBuilds"
		], `${run.route} run keys`);
		const prefix = `${run.route}/records/`;
		const recordPaths = [...files.keys()].filter(path => path.startsWith(prefix))
			.map(path => path.slice(prefix.length)).sort();
		assert.equal(recordPaths.length, run.recordCount);
		const checked = await checkMutualCheckedRecordJvmReport(path => {
			const bytes = files.get(prefix + path);
			assert.ok(bytes, path); return bytes;
		}, { route: run.route, producerCommit: index.producerCommit });
		assert.deepEqual(recordPaths, checked.recordPaths);
		assert.deepEqual(run, {
			route: checked.route, recordCount: checked.recordPaths.length
			, reportSha256: checked.reportSha256, packages: checked.packages
			, runtimeIdentity: checked.runtimeIdentity
			, bindingIrSha256: checked.bindingIrSha256
			, layoutSha256: checked.layoutSha256
			, jdkVersion: checked.jdkVersion
			, kotlinVersion: checked.kotlinVersion, results: checked.results
			, executions: checked.executions
			, independentBuilds: checked.independentBuilds
		});
		expectedPaths.push(...recordPaths.map(path => prefix + path));
		runs.push(checked);
	}
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit, archiveCommit: index.archiveCommit
		, runs, files: index.files, sourceSnapshots: index.sourceSnapshots
		, limitations: index.limitations, supportPromoted: false
		, hostedAcceptance: false
	};
};
