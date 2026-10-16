/**
 * Authenticate the immutable nested checked-record npm and browser archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	nestedCheckedRecordNpmRoutes,
	nestedCheckedRecordNpmSelection
} from "./nested-checked-record-npm-fixture.mjs";
import {
	checkNestedCheckedRecordBrowserReport,
	nestedCheckedRecordBrowserRecordPaths
} from "./nested-checked-record-browser-report.mjs";

export const nestedCheckedRecordBrowserArchive
	= "docs/evidence/nested-checked-record-browser-20261016";
export const nestedCheckedRecordBrowserArchiveSha256
	= "9ba5c13be3f015d51bc51ccd3c8eeda7e0069e333e07b864de01ed3d1e3e33f7";
export const nestedCheckedRecordBrowserProducer
	= "340f6c1dabd1cad6fa313c41682c9b2c3fd08d24";
export const nestedCheckedRecordBrowserConsumer
	= "d402c7a12eb7d9b69a74c9931415082ce3dd7059";
export const nestedCheckedRecordBrowserChecker
	= "d184cee67224beebf5d82ef036310b82ebaca863";
export const nestedCheckedRecordBrowserArchiver
	= "85bdb8290a13ff544b142297452b981495a91187";

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
 * Reconcile every archived byte, source snapshot, accepted report and control receipt.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkNestedCheckedRecordBrowserArchive = async (read = readFile) => {
	const indexBytes = await read(`${nestedCheckedRecordBrowserArchive}/index.json`);
	assert.equal(sha256(indexBytes), nestedCheckedRecordBrowserArchiveSha256);
	const index = json(indexBytes), files = new Map();
	exactKeys(index, [
		"schemaVersion", "kind", "producerCommit", "consumerCommit"
		, "checkerCommit", "archiveCommit", "runtime", "browserVersions"
		, "loadCeiling", "runs", "sourceSnapshots", "limitations", "files"
	]);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "nested-checked-record-browser-installed-v1");
	assert.equal(index.producerCommit, nestedCheckedRecordBrowserProducer);
	assert.equal(index.consumerCommit, nestedCheckedRecordBrowserConsumer);
	assert.equal(index.checkerCommit, nestedCheckedRecordBrowserChecker);
	assert.equal(index.archiveCommit, nestedCheckedRecordBrowserArchiver);
	assert.deepEqual(index.runtime, {
		node: "v22.23.2", platform: "linux", arch: "x64"
	});
	assert.deepEqual(index.browserVersions, {
		chromium: "151.0.7922.34", firefox: "153.0", webkit: "26.5"
	});
	assert.equal(index.loadCeiling, 8);
	assert.equal(index.limitations.length, 5);
	assert.ok(index.limitations.every(value => typeof value === "string" && value.length));
	let previousPath = "";
	for(const entry of index.files)
	{
		exactKeys(entry, ["path", "bytes", "sha256"]);
		assert.ok(safePath(entry.path) && !files.has(entry.path));
		assert.ok(!previousPath || previousPath.localeCompare(entry.path) < 0);
		previousPath = entry.path;
		const bytes = await read(`${nestedCheckedRecordBrowserArchive}/${entry.path}`);
		assert.equal(bytes.length, entry.bytes, entry.path);
		assert.equal(sha256(bytes), entry.sha256, entry.path);
		files.set(entry.path, bytes);
	}
	assert.equal(files.size, 410);
	assert.deepEqual(index.sourceSnapshots.map(({ role, commit }) => ({ role, commit })), [
		{ role: "producer", commit: nestedCheckedRecordBrowserProducer }
		, { role: "consumer", commit: nestedCheckedRecordBrowserConsumer }
		, { role: "checker", commit: nestedCheckedRecordBrowserChecker }
		, { role: "archive", commit: nestedCheckedRecordBrowserArchiver }
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
				maxBuffer: 32 * 1024 * 1024
			});
			assert.deepEqual(files.get(archivePath), current);
			expectedPaths.push(archivePath);
		}
	}
	assert.deepEqual(index.runs.map(run => run.route), nestedCheckedRecordNpmRoutes);
	const routes = [];
	for(const run of index.runs)
	{
		exactKeys(run, [
			"route", "mode", "producerCommit", "consumerCommit", "checkerCommit"
			, "runtime", "recordCount", "counts", "reportSha256"
			, "browserReportSha256", "npmControlsSha256"
			, "browserControlsSha256", "controls"
		]);
		const selection = nestedCheckedRecordNpmSelection(run.route);
		assert.equal(run.mode, selection.mode);
		assert.equal(run.producerCommit, index.producerCommit);
		assert.equal(run.consumerCommit, index.consumerCommit);
		assert.equal(run.checkerCommit, index.checkerCommit);
		assert.deepEqual(run.runtime, index.runtime);
		const prefix = `${run.route}/records/`;
		const get = path => {
			const value = files.get(prefix + path);
			assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const npm = json(get("report.json"));
		const paths = nestedCheckedRecordBrowserRecordPaths(run.mode, npm.receipt);
		assert.equal(run.recordCount, paths.length + 2);
		assert.equal(run.reportSha256, sha256(get("report.json")));
		assert.equal(run.browserReportSha256, sha256(get("browser.json")));
		assert.equal(run.npmControlsSha256, sha256(get("controls.json")));
		assert.equal(run.browserControlsSha256, sha256(get("browser-controls.json")));
		const checked = await checkNestedCheckedRecordBrowserReport(
			async path => get(path), {
				route: run.route, producerCommit: index.producerCommit
				, consumerCommit: index.consumerCommit, runtime: index.runtime
			}
		);
		assert.deepEqual(run.counts, checked);
		assert.deepEqual(checked.browserVersions, index.browserVersions);
		const npmControls = json(get("controls.json"));
		const browserControls = json(get("browser-controls.json"));
		assert.equal(npmControls.recordControls, 64);
		assert.equal(npmControls.reportControls, 10);
		assert.equal(npmControls.adapterControls, selection.resultOnly ? 4 : 7);
		assert.equal(browserControls.checkerCommit, index.checkerCommit);
		assert.deepEqual(browserControls.accepted, checked);
		assert.deepEqual(run.controls, {
			record: paths.length * 2, npmReport: 10
			, npmAdapter: selection.resultOnly ? 4 : 7, browser: 162
		});
		assert.equal(browserControls.recordControls, run.controls.record);
		assert.equal(browserControls.npmReportControls, run.controls.npmReport);
		assert.equal(browserControls.npmAdapterControls, run.controls.npmAdapter);
		assert.equal(browserControls.browserControls, run.controls.browser);
		expectedPaths.push(...paths.map(path => prefix + path)
			, prefix + "controls.json", prefix + "browser-controls.json");
		routes.push({ ...checked, controls: run.controls });
	}
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit, consumerCommit: index.consumerCommit
		, checkerCommit: index.checkerCommit, archiveCommit: index.archiveCommit
		, routes, files: index.files, sourceSnapshots: index.sourceSnapshots
		, supportPromoted: false, hostedAcceptance: false
	};
};
