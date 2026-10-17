/**
 * Authenticate the immutable hosted inherited checked-record npm/browser
 * archive and replay its exact CI checker inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkInheritedCheckedRecordBrowserCiRecords
} from "./inherited-checked-record-browser-ci-report.mjs";
import {
	inheritedCheckedRecordNpmRoutes,
	inheritedCheckedRecordNpmSelection
} from "./inherited-checked-record-npm-fixture.mjs";
import {
	inheritedCheckedRecordBrowserEvidence
	, inheritedCheckedRecordBrowserLoadCeiling
	, inheritedCheckedRecordBrowserPinnedRevisions
	, inheritedCheckedRecordBrowserSelectedSources
} from "./inherited-checked-record-browser-provenance.mjs";
import {
	inheritedCheckedRecordBrowserOriginal
} from "./inherited-checked-record-browser-evidence-sources.mjs";

export { inheritedCheckedRecordBrowserEvidence } from "./inherited-checked-record-browser-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const inheritedCheckedRecordBrowserEvidenceSha256
	= "e407d8a426f8102084cbd40145922cc3508d73e896cae60917886aad26cfb248";

const cellFiles = [
	"browser.tap", "controls.tap", "npm.tap", "runtime-after.json"
	, "runtime-before.json", "verification.json"
];
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_@.+/-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
let cached;

/**
 * Verify every archived byte, source snapshot, TAP stream and accepted report.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkInheritedCheckedRecordBrowserEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const revisions = inheritedCheckedRecordBrowserPinnedRevisions();
		assert.match(inheritedCheckedRecordBrowserEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the inherited browser archive index first");
		const indexBytes = Buffer.from(await read(
			`${inheritedCheckedRecordBrowserEvidence}/index.json`));
		assert.equal(sha256(indexBytes)
			, inheritedCheckedRecordBrowserEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "browserVersions", "checkerCommit", "consumerCommit"
			, "files", "hostedRun", "kind", "limitations", "loadCeiling"
			, "npmCheckerCommit", "producerCommit", "runs", "runtime"
			, "schemaVersion", "selectedSources"
		]);
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "inherited-checked-record-browser-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.npmCheckerCommit, revisions.npmChecker);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling, inheritedCheckedRecordBrowserLoadCeiling);
		assert.deepEqual(Object.keys(index.runtime).sort(), ["arch", "node", "platform"]);
		assert.deepEqual(Object.keys(index.browserVersions).sort()
			, ["chromium", "firefox", "webkit"]);
		assert.deepEqual(Object.keys(index.hostedRun).sort()
			, ["repository", "runId", "url"]);
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.ok(Number.isSafeInteger(index.hostedRun.runId)
			&& index.hostedRun.runId > 0);
		assert.equal(index.hostedRun.url
			, `https://github.com/seanmorris/lean-bridge/actions/runs/${index.hostedRun.runId}`);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7);
		let previousPath = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previousPath || previousPath.localeCompare(entry.path) < 0);
			previousPath = entry.path;
			const value = Buffer.from(await read(
				`${inheritedCheckedRecordBrowserEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path);
			assert.ok(Buffer.isBuffer(value), path);
			return value;
		};
		const selectedSources = inheritedCheckedRecordBrowserSelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), inheritedCheckedRecordBrowserOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route)
			, inheritedCheckedRecordNpmRoutes);
		const accepted = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "browserControlsSha256", "browserReportSha256"
				, "browserTapSha256", "controls"
				, "controlsTapSha256", "mode", "npmControlsSha256"
				, "npmTapSha256", "recordCount", "reportSha256", "resultOnly"
				, "route", "runtimeSha256", "verificationSha256"
			]);
			const selection = inheritedCheckedRecordNpmSelection(run.route);
			assert.equal(run.mode, selection.mode);
			assert.equal(run.resultOnly, selection.resultOnly);
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, bytes] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), bytes);
			const cell = path => get(`${run.route}/${path}`);
			const before = cell("runtime-before.json");
			assert.deepEqual(cell("runtime-after.json"), before);
			assert.equal(run.runtimeSha256, sha256(before));
			const runtime = JSON.parse(before);
			assert.deepEqual(runtime, index.runtime);
			const options = {
				route: run.route, producer: revisions.producer
				, "npm-checker": revisions.npmChecker, consumer: revisions.consumer
				, checker: revisions.checker, directory: "records"
				, "npm-tap": "npm.tap", "browser-tap": "browser.tap"
				, "controls-tap": "controls.tap", runtime: "runtime-before.json"
			};
			const npmTap = cell("npm.tap"), browserTap = cell("browser.tap");
			const controlsTap = cell("controls.tap");
			assert.equal(run.npmTapSha256, sha256(npmTap));
			assert.equal(run.browserTapSha256, sha256(browserTap));
			assert.equal(run.controlsTapSha256, sha256(controlsTap));
			const checked = await checkInheritedCheckedRecordBrowserCiRecords(
				options, {
					npmTap: npmTap.toString(), browserTap: browserTap.toString()
					, controlsTap: controlsTap.toString(), runtime
					, paths: [...records.keys()].sort()
					, read: path => {
						assert.ok(records.has(path), path); return records.get(path);
					}
				}
			);
			assert.equal(run.recordCount, records.size);
			assert.deepEqual(run.accepted, checked);
			assert.deepEqual(run.controls, checked.controls);
			assert.deepEqual(checked.browserVersions, index.browserVersions);
			assert.equal(run.reportSha256, sha256(records.get("report.json")));
			assert.equal(run.browserReportSha256
				, sha256(records.get("browser.json")));
			assert.equal(run.npmControlsSha256
				, sha256(records.get("controls.json")));
			assert.equal(run.browserControlsSha256
				, sha256(records.get("browser-controls.json")));
			const verification = cell("verification.json");
			assert.equal(run.verificationSha256, sha256(verification));
			assert.equal(verification.toString(), canonicalJson(checked));
			expectedPaths.push(...[...records.keys()].map(path => prefix + path)
				, ...cellFiles.map(path => `${run.route}/${path}`));
			accepted.push(checked);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, routes: accepted, runtime: index.runtime
			, browserVersions: index.browserVersions, hostedRun: index.hostedRun
			, files: index.files, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
