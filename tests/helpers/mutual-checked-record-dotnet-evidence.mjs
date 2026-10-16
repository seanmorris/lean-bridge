/**
 * Authenticate every retained recursive checked-record .NET package artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	mutualCheckedRecordDotnetCheckerSources, mutualCheckedRecordDotnetEvidence
	, mutualCheckedRecordDotnetOriginal, mutualCheckedRecordDotnetProducer
	, mutualCheckedRecordDotnetProducerSources, mutualCheckedRecordDotnetRoutes
} from "./mutual-checked-record-dotnet-provenance.mjs";
import {
	checkMutualCheckedRecordDotnetReport
} from "./mutual-checked-record-dotnet-report.mjs";

export { mutualCheckedRecordDotnetEvidence };
// Filled with the immutable index identity after the one-shot archive is committed.
export const mutualCheckedRecordDotnetEvidenceSha256
	= "6614595658b38c4d7de1ff865666d7f9c28dd31f84a4aeaddef156ca25e8397c";

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
export const checkMutualCheckedRecordDotnetEvidence = async (read = readFile) => {
	const indexPath = `${mutualCheckedRecordDotnetEvidence}/index.json`;
	const indexBytes = Buffer.from(await read(indexPath));
	assert.equal(sha256(indexBytes), mutualCheckedRecordDotnetEvidenceSha256);
	const index = json(indexBytes, indexPath), files = new Map();
	exactKeys(index, [
		"schemaVersion", "kind", "producerCommit", "archiveCommit", "runtime"
		, "runs", "sourceSnapshots", "limitations", "files"
	], "index keys");
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "mutual-checked-record-dotnet-installed-v1");
	assert.equal(index.producerCommit, mutualCheckedRecordDotnetProducer);
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
			`${mutualCheckedRecordDotnetEvidence}/${entry.path}`
		));
		assert.equal(bytes.length, entry.bytes, entry.path);
		assert.equal(sha256(bytes), entry.sha256, entry.path);
		files.set(entry.path, bytes);
	}
	const snapshots = [
		{ role: "producer", commit: mutualCheckedRecordDotnetProducer
			, paths: mutualCheckedRecordDotnetProducerSources() }
		, { role: "checker", commit: index.archiveCommit
			, paths: mutualCheckedRecordDotnetCheckerSources(index.archiveCommit) }
	];
	assert.deepEqual(index.sourceSnapshots, snapshots);
	const expectedPaths = [];
	for(const snapshot of snapshots) for(const path of snapshot.paths)
	{
		const retained = `sources/${snapshot.role}/${path}`;
		assert.deepEqual(files.get(retained)
			, mutualCheckedRecordDotnetOriginal(snapshot.commit, path), retained);
		expectedPaths.push(retained);
	}
	assert.deepEqual(index.runs.map(run => run.route), mutualCheckedRecordDotnetRoutes);
	const runs = [];
	for(const run of index.runs)
	{
		exactKeys(run, [
			"route", "recordCount", "reportSha256", "package"
			, "runtimeIdentity", "bindingIrSha256", "layoutSha256"
			, "sdkVersion", "frameworkVersion", "checks", "rejections"
			, "hostRejections", "calls", "snapshots", "recoveries", "rounds"
			, "executions", "independentBuilds"
		], `${run.route} run keys`);
		const prefix = `${run.route}/records/`;
		const recordPaths = [...files.keys()].filter(path => path.startsWith(prefix))
			.map(path => path.slice(prefix.length)).sort();
		assert.equal(recordPaths.length, run.recordCount);
		const checked = await checkMutualCheckedRecordDotnetReport(path => {
			const bytes = files.get(prefix + path); assert.ok(bytes, path); return bytes;
		}, { route: run.route, producerCommit: index.producerCommit });
		assert.deepEqual(recordPaths, checked.recordPaths);
		assert.deepEqual(run, {
			route: checked.route, recordCount: checked.recordPaths.length
			, reportSha256: checked.reportSha256, package: checked.package
			, runtimeIdentity: checked.runtimeIdentity
			, bindingIrSha256: checked.bindingIrSha256
			, layoutSha256: checked.layoutSha256, sdkVersion: checked.sdkVersion
			, frameworkVersion: checked.frameworkVersion
			, checks: checked.result.checks, rejections: checked.result.rejections
			, hostRejections: checked.result.hostRejections, calls: checked.result.calls
			, snapshots: checked.result.snapshots, recoveries: checked.result.recoveries
			, rounds: checked.result.rounds, executions: checked.executions
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
