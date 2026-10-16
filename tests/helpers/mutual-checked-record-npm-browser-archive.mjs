/**
 * Authenticate every retained recursive checked-record Node/browser artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkMutualCheckedRecordBrowserReport
} from "./mutual-checked-record-browser-report.mjs";
import {
	mutualCheckedRecordNpmRoutes
} from "./mutual-checked-record-npm-fixture.mjs";

export const mutualCheckedRecordNpmBrowserArchive
	= "docs/evidence/mutual-checked-record-npm-browser-20261016";
export const mutualCheckedRecordNpmBrowserArchiveSha256
	= "e3c2ad277e96e97350789436d6c7b0a8f84cef94aad8571d7391b0630ecfb27b";
export const mutualCheckedRecordNpmBrowserProducer
	= "c3e8099992d277bdb68e8696de31f4ae8e070ee7";
export const mutualCheckedRecordNpmBrowserConsumer
	= "c3e8099992d277bdb68e8696de31f4ae8e070ee7";
export const mutualCheckedRecordNpmBrowserArchiver
	= "1eb50b3a6ec1ef0773e783577316270f69e6de48";

const exactKeys = (value, keys) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort());
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_@.+/-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = bytes => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value));
	return value;
};

/**
 * Reconcile every archived byte, source snapshot and accepted execution report.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkMutualCheckedRecordNpmBrowserArchive = async (
	read = readFile
) => {
	const indexPath = `${mutualCheckedRecordNpmBrowserArchive}/index.json`;
	const indexBytes = await read(indexPath);
	assert.equal(sha256(indexBytes), mutualCheckedRecordNpmBrowserArchiveSha256);
	const index = json(indexBytes), files = new Map();
	exactKeys(index, [
		"schemaVersion", "kind", "producerCommit", "consumerCommit"
		, "archiveCommit", "runtime", "browserVersions", "runs"
		, "sourceSnapshots", "limitations", "files"
	]);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "mutual-checked-record-npm-browser-installed-v1");
	assert.equal(index.producerCommit, mutualCheckedRecordNpmBrowserProducer);
	assert.equal(index.consumerCommit, mutualCheckedRecordNpmBrowserConsumer);
	assert.equal(index.archiveCommit, mutualCheckedRecordNpmBrowserArchiver);
	assert.deepEqual(index.runtime, {
		node: "v22.23.2", platform: "linux", arch: "x64"
	});
	assert.deepEqual(index.browserVersions, {
		chromium: "151.0.7922.34", firefox: "153.0", webkit: "26.5"
	});
	assert.equal(index.limitations.length, 5);
	assert.ok(index.limitations.every(value =>
		typeof value === "string" && value.length > 0));
	let previousPath = "";
	for(const entry of index.files)
	{
		exactKeys(entry, ["path", "bytes", "sha256"]);
		assert.ok(safePath(entry.path) && !files.has(entry.path));
		assert.ok(!previousPath || previousPath.localeCompare(entry.path) < 0);
		previousPath = entry.path;
		const bytes = await read(`${mutualCheckedRecordNpmBrowserArchive}/${entry.path}`);
		assert.equal(bytes.length, entry.bytes, entry.path);
		assert.equal(sha256(bytes), entry.sha256, entry.path);
		files.set(entry.path, bytes);
	}
	assert.equal(files.size, 238);
	assert.deepEqual(index.sourceSnapshots.map(({ role, commit }) => ({ role, commit })), [
		{ role: "producer", commit: mutualCheckedRecordNpmBrowserProducer }
		, { role: "consumer", commit: mutualCheckedRecordNpmBrowserConsumer }
		, { role: "checker", commit: mutualCheckedRecordNpmBrowserArchiver }
	]);
	const expectedPaths = [];
	for(const snapshot of index.sourceSnapshots)
	{
		exactKeys(snapshot, ["role", "commit", "paths"]);
		assert.deepEqual(snapshot.paths, [...new Set(snapshot.paths)].sort());
		for(const path of snapshot.paths)
		{
			assert.ok(safePath(path));
			const archivePath = `sources/${snapshot.role}/${path}`;
			const current = execFileSync("git", ["show", `${snapshot.commit}:${path}`], {
				maxBuffer: 64 * 1024 * 1024
			});
			assert.deepEqual(files.get(archivePath), current, archivePath);
			expectedPaths.push(archivePath);
		}
	}
	assert.deepEqual(index.runs.map(run => run.route), mutualCheckedRecordNpmRoutes);
	const routes = [];
	for(const run of index.runs)
	{
		exactKeys(run, [
			"route", "producerCommit", "consumerCommit", "runtime", "recordCount"
			, "npmReportSha256", "browserReportSha256", "nodeObservations"
			, "browserExecutions", "lifecycleObservations", "checksPerExecution"
			, "rejectionsPerExecution", "recoveriesPerExecution"
			, "componentArchive", "runtimeArchive"
		]);
		assert.equal(run.producerCommit, index.producerCommit);
		assert.equal(run.consumerCommit, index.consumerCommit);
		assert.deepEqual(run.runtime, index.runtime);
		const prefix = `${run.route}/records/`;
		const recordPaths = [...files.keys()].filter(path => path.startsWith(prefix));
		assert.equal(recordPaths.length, run.recordCount);
		const get = path => {
			const bytes = files.get(prefix + path);
			assert.ok(Buffer.isBuffer(bytes), path);
			return bytes;
		};
		const checked = await checkMutualCheckedRecordBrowserReport(get, {
			route: run.route, producerCommit: index.producerCommit
			, consumerCommit: index.consumerCommit, runtime: index.runtime
		});
		assert.equal(run.npmReportSha256, checked.npmReportSha256);
		assert.equal(run.browserReportSha256, checked.browserReportSha256);
		assert.equal(run.nodeObservations, checked.nodeObservations);
		assert.equal(run.browserExecutions, checked.browserExecutions);
		assert.equal(run.lifecycleObservations, checked.lifecycleObservations);
		assert.equal(run.checksPerExecution, checked.expected.checks);
		assert.equal(run.rejectionsPerExecution, checked.expected.rejections);
		assert.equal(run.recoveriesPerExecution, checked.expected.recoveries);
		assert.deepEqual(run.componentArchive, checked.receipt.package);
		assert.deepEqual(run.runtimeArchive, checked.receipt.runtime);
		assert.deepEqual(checked.browserVersions, index.browserVersions);
		expectedPaths.push(...recordPaths);
		routes.push({ ...checked, recordCount: recordPaths.length });
	}
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit, consumerCommit: index.consumerCommit
		, archiveCommit: index.archiveCommit, routes, files: index.files
		, sourceSnapshots: index.sourceSnapshots, limitations: index.limitations
		, supportPromoted: false, hostedAcceptance: false
	};
};
