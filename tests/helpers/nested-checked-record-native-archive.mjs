/**
 * Authenticate the immutable nested checked-record C/C++ acceptance archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkNestedCheckedRecordNativeControls
} from "./nested-checked-record-native-controls.mjs";
import {
	nestedCheckedRecordNativeRecords
} from "./nested-checked-record-native-report.mjs";
import {
	nestedCheckedRecordNativeEvidence
	, nestedCheckedRecordNativeProducer
	, nestedCheckedRecordNativeSelectedSources
	, nestedCheckedRecordNativeSelections
} from "./nested-checked-record-native-evidence.mjs";

export const nestedCheckedRecordNativeArchiveSha256
	= "902f0f40499a7dfad2cfc8c4ba7bad8e1789d0a4eaf32b09fbee24746bbd268c";
export const nestedCheckedRecordNativeArchiver
	= "1e6f4c5983be741f2065cef7e703fe2ffe76d766";
export const nestedCheckedRecordNativeArchiveSources = Object.freeze([
	"scripts/archive-nested-checked-record-native.mjs"
	, "tests/helpers/nested-checked-record-native-evidence.mjs"
]);

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
const original = (commit, path) => execFileSync("git", ["show", `${commit}:${path}`]
	, { maxBuffer: 64 * 1024 * 1024 });

/**
 * Reconcile every archived record, package byte, source snapshot and destructive control.
 *
 * @param read - Repository-relative archive reader.
 */
export const checkNestedCheckedRecordNativeArchive = async (read = readFile) => {
	const indexPath = `${nestedCheckedRecordNativeEvidence}/index.json`;
	const indexBytes = await read(indexPath);
	assert.equal(sha256(indexBytes), nestedCheckedRecordNativeArchiveSha256);
	const index = json(indexBytes), entries = new Map();
	exactKeys(index, [
		"schemaVersion", "kind", "producerCommit", "archiveCommit"
		, "runtime", "floor", "maxLoad", "runs", "selectedSources"
		, "archiveSources", "files", "limitations"
	]);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "nested-checked-record-native-installed-v1");
	assert.equal(index.producerCommit, nestedCheckedRecordNativeProducer);
	assert.equal(index.archiveCommit, nestedCheckedRecordNativeArchiver);
	assert.deepEqual(index.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
	assert.equal(index.floor, "2.36"); assert.equal(index.maxLoad, 12);
	assert.equal(index.limitations.length, 7);
	assert.ok(index.limitations.every(value => typeof value === "string" && value.length));
	assert.equal(index.files.length, 672);
	let previous = "";
	for(const entry of index.files)
	{
		exactKeys(entry, ["path", "bytes", "sha256"], "file");
		assert.ok(safePath(entry.path) && !entries.has(entry.path), entry.path);
		assert.ok(!previous || previous.localeCompare(entry.path) < 0);
		previous = entry.path;
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
		assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		const bytes = await read(`${nestedCheckedRecordNativeEvidence}/${entry.path}`);
		assert.equal(bytes.length, entry.bytes, entry.path);
		assert.equal(sha256(bytes), entry.sha256, entry.path);
		entries.set(entry.path, entry);
	}
	const selectedSources = nestedCheckedRecordNativeSelectedSources();
	assert.deepEqual(index.selectedSources, selectedSources);
	assert.deepEqual(index.archiveSources, [...nestedCheckedRecordNativeArchiveSources]);
	const expectedPaths = [];
	for(const path of selectedSources)
	{
		const archived = `sources/producer/${path}`;
		assert.deepEqual(await read(`${nestedCheckedRecordNativeEvidence}/${archived}`)
			, original(index.producerCommit, path), path);
		expectedPaths.push(archived);
	}
	for(const path of index.archiveSources)
	{
		const archived = `sources/archive/${path}`;
		assert.deepEqual(await read(`${nestedCheckedRecordNativeEvidence}/${archived}`)
			, original(index.archiveCommit, path), path);
		expectedPaths.push(archived);
	}
	assert.deepEqual(index.runs.map(({ route, mode, originalRoot }) => ({
		route, mode, originalRoot
	})), nestedCheckedRecordNativeSelections.map(selection => ({
		route: selection.route, mode: selection.mode, originalRoot: selection.root
	})));
	const checkedRuns = [];
	for(const run of index.runs)
	{
		exactKeys(run, [
			"label", "route", "mode", "originalRoot", "producerCommit"
			, "runtime", "floor", "maxLoad", "recordCount", "reportSha256"
			, "controlsSha256", "counts", "executions", "initialExecutions"
			, "controls", "artifacts"
		]);
		assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.equal(run.producerCommit, index.producerCommit);
		assert.deepEqual(run.runtime, index.runtime);
		assert.equal(run.floor, index.floor); assert.equal(run.maxLoad, index.maxLoad);
		const prefix = `${run.label}/records/`;
		const archivedRead = path => {
			assert.ok(entries.has(prefix + path), path);
			return read(`${nestedCheckedRecordNativeEvidence}/${prefix}${path}`);
		};
		const receipt = json(await archivedRead("build-0/package-set-receipt.json"));
		const records = [...nestedCheckedRecordNativeRecords(run.route, receipt)
			, "controls.json"];
		assert.equal(run.recordCount, records.length);
		assert.equal(run.reportSha256, sha256(await archivedRead("report.json")));
		assert.equal(run.controlsSha256, sha256(await archivedRead("controls.json")));
		const options = {
			route: run.route, mode: run.mode, producerCommit: index.producerCommit
			, runtime: index.runtime, floor: index.floor, maxLoad: index.maxLoad
		};
		const checked = await checkNestedCheckedRecordNativeControls(
			archivedRead, options);
		assert.deepEqual(json(await archivedRead("controls.json")), checked);
		assert.deepEqual(run.counts, checked.counts);
		assert.equal(run.executions, checked.executions);
		assert.equal(run.initialExecutions, checked.initialExecutions);
		assert.deepEqual(run.controls, {
			record: checked.recordControls, report: checked.reportControls
			, resource: checked.resourceControls, model: checked.modelControls
			, package: checked.packageControls
		});
		assert.deepEqual(run.artifacts, receipt.packages.flatMap(pkg =>
			pkg.artifacts.map(artifact => ({
				profile: pkg.target, path: artifact.path, bytes: artifact.bytes
				, sha256: artifact.sha256
			}))
		));
		expectedPaths.push(...records.map(path => prefix + path));
		checkedRuns.push(checked);
	}
	assert.deepEqual([...entries.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit, archiveCommit: index.archiveCommit
		, runtime: index.runtime, floor: index.floor, maxLoad: index.maxLoad
		, runs: checkedRuns, files: index.files, selectedSources
		, installedProfiles: ["c", "cpp"], supportPromoted: false
		, hostedAcceptance: false
	};
};
