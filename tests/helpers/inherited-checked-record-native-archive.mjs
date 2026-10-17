/**
 * Authenticate the immutable hosted inherited checked-record C/C++ acceptance archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertInheritedCheckedRecordNativeCiTap
} from "./inherited-checked-record-native-ci-report.mjs";
import {
	checkInheritedCheckedRecordNativeControls
} from "./inherited-checked-record-native-controls.mjs";
import {
	inheritedCheckedRecordNativeRecords
} from "./inherited-checked-record-native-report.mjs";
import {
	inheritedCheckedRecordNativeEvidence, inheritedCheckedRecordNativeEvidenceSources
	, inheritedCheckedRecordNativeFloor, inheritedCheckedRecordNativeHostedRun
	, inheritedCheckedRecordNativeHostedRuntime, inheritedCheckedRecordNativeMaxLoad
	, inheritedCheckedRecordNativeOriginal, inheritedCheckedRecordNativePinnedRevisions
	, inheritedCheckedRecordNativeSelections
} from "./inherited-checked-record-native-evidence.mjs";

/** Pinned to the index the archive script prints; null refuses every check. */
export const inheritedCheckedRecordNativeArchiveSha256 = null;

const exactKeys = (value, keys, label = "record") => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_@.+/-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = bytes => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value));
	return value;
};

/**
 * Reconcile every archived record, TAP, hosted verification, source snapshot and destructive control.
 *
 * @param read - Repository-relative archive reader.
 */
export const checkInheritedCheckedRecordNativeArchive = async (read = readFile) => {
	assert.match(inheritedCheckedRecordNativeArchiveSha256 ?? "", /^[a-f0-9]{64}$/u
		, "Pin the inherited native archive index first");
	const indexBytes = await read(`${inheritedCheckedRecordNativeEvidence}/index.json`);
	assert.equal(sha256(indexBytes), inheritedCheckedRecordNativeArchiveSha256);
	const revisions = inheritedCheckedRecordNativePinnedRevisions();
	const index = json(indexBytes), entries = new Map();
	exactKeys(index, [
		"schemaVersion", "kind", "producerCommit", "checkerCommit", "archiveCommit"
		, "hostedRun", "runtime", "floor", "maxLoad"
		, "runs", "selectedSources", "files", "limitations"
	]);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "inherited-checked-record-native-hosted-v1");
	assert.equal(index.producerCommit, revisions.producer);
	assert.equal(index.checkerCommit, revisions.checker);
	assert.equal(index.archiveCommit, revisions.archiver);
	assert.deepEqual(index.hostedRun, inheritedCheckedRecordNativeHostedRun);
	assert.deepEqual(index.runtime, inheritedCheckedRecordNativeHostedRuntime);
	assert.equal(index.floor, inheritedCheckedRecordNativeFloor);
	assert.equal(index.maxLoad, inheritedCheckedRecordNativeMaxLoad);
	assert.equal(index.limitations.length, 5);
	assert.ok(index.limitations.every(value => typeof value === "string" && value.length));
	let previous = "";
	for(const entry of index.files)
	{
		exactKeys(entry, ["path", "bytes", "sha256"], "file");
		assert.ok(safePath(entry.path) && !entries.has(entry.path), entry.path);
		assert.ok(!previous || previous.localeCompare(entry.path) < 0, entry.path);
		previous = entry.path;
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
		assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		const bytes = await read(`${inheritedCheckedRecordNativeEvidence}/${entry.path}`);
		assert.equal(bytes.length, entry.bytes, entry.path);
		assert.equal(sha256(bytes), entry.sha256, entry.path);
		entries.set(entry.path, entry);
	}
	// Every producer, checker and archiver byte is authenticated against its exact revision.
	const selectedSources = inheritedCheckedRecordNativeEvidenceSources(revisions);
	assert.deepEqual(index.selectedSources, selectedSources);
	const expectedPaths = [];
	for(const { role, revision, path } of selectedSources)
	{
		const archived = `sources/${role}/${path}`;
		assert.ok(entries.has(archived), archived);
		assert.deepEqual(await read(`${inheritedCheckedRecordNativeEvidence}/${archived}`)
			, inheritedCheckedRecordNativeOriginal(revision, path), archived);
		expectedPaths.push(archived);
	}
	assert.deepEqual(index.runs.map(({ route, mode }) => ({ route, mode }))
		, inheritedCheckedRecordNativeSelections.map(({ route, mode }) => ({ route, mode })));
	const checkedRuns = [];
	for(const run of index.runs)
	{
		exactKeys(run, ["label", "route", "mode", "recordCount", "tapSha256"
			, "verificationSha256", "reportSha256", "controls", "artifacts"], "run");
		assert.equal(run.label, `${run.route}-${run.mode}`);
		const archivedRead = path => {
			assert.ok(entries.has(`${run.label}/records/${path}`), path);
			return read(`${inheritedCheckedRecordNativeEvidence}/${run.label}/records/${path}`);
		};
		const tap = await read(`${inheritedCheckedRecordNativeEvidence}/${run.label}/run.tap`);
		assert.equal(sha256(tap), run.tapSha256);
		assertInheritedCheckedRecordNativeCiTap(tap.toString(), run.route, run.mode);
		const receipt = json(await archivedRead("build-0/package-set-receipt.json"));
		const records = [...inheritedCheckedRecordNativeRecords(run.route, receipt), "controls.json"];
		assert.equal(run.recordCount, records.length);
		assert.equal(run.reportSha256, sha256(await archivedRead("report.json")));
		// Replay the hosted checker independently; it must reproduce the hosted verification bytes.
		const checked = await checkInheritedCheckedRecordNativeControls(archivedRead, {
			route: run.route, mode: run.mode, producerCommit: index.producerCommit
			, runtime: index.runtime, floor: index.floor, maxLoad: index.maxLoad
		});
		const verification = await read(`${inheritedCheckedRecordNativeEvidence}/${run.label}/verification.json`);
		assert.equal(sha256(verification), run.verificationSha256);
		assert.equal(verification.toString(), canonicalJson(checked), run.label);
		assert.equal((await archivedRead("controls.json")).toString(), canonicalJson(checked), run.label);
		assert.deepEqual(run.controls, {
			record: checked.recordControls, report: checked.reportControls
			, resource: checked.resourceControls, model: checked.modelControls
			, package: checked.packageControls
		});
		assert.deepEqual(run.artifacts, receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({
			profile: pkg.target, path: artifact.path
			, bytes: artifact.bytes, sha256: artifact.sha256
		}))));
		expectedPaths.push(`${run.label}/run.tap`, `${run.label}/verification.json`
			, ...records.map(path => `${run.label}/records/${path}`));
		checkedRuns.push(checked);
	}
	assert.deepEqual([...entries.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit, checkerCommit: index.checkerCommit
		, archiveCommit: index.archiveCommit, hostedRun: index.hostedRun
		, runtime: index.runtime, floor: index.floor, maxLoad: index.maxLoad
		, runs: checkedRuns, files: index.files, selectedSources
		, installedProfiles: ["c", "cpp"]
		, supportPromoted: false, hostedAcceptance: true
	};
};
