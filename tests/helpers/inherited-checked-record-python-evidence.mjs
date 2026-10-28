/**
 * Authenticate the immutable hosted inherited checked-record Python archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { inheritedCheckedRecordLaneFiles } from "./inherited-checked-record-lane-files.mjs";
import {
	assertInheritedCheckedRecordPythonCiTap
	, checkInheritedCheckedRecordPythonCiRecords
} from "./inherited-checked-record-python-ci-report.mjs";
import {
	checkInheritedCheckedRecordPythonControls
} from "./inherited-checked-record-python-controls.mjs";
import {
	assertInheritedCheckedRecordPythonInterpreter
} from "./inherited-checked-record-python-environment-records.mjs";
import {
	inheritedCheckedRecordPythonMinors
} from "./inherited-checked-record-python-fixture.mjs";
import {
	inheritedCheckedRecordPythonEvidenceOriginal
} from "./inherited-checked-record-python-evidence-sources.mjs";
import {
	inheritedCheckedRecordPythonEvidence
	, inheritedCheckedRecordPythonEvidenceFloor
	, inheritedCheckedRecordPythonEvidenceLoadCeiling
	, inheritedCheckedRecordPythonPinnedRevisions
	, inheritedCheckedRecordPythonSelectedSources
	, inheritedCheckedRecordPythonSelections
} from "./inherited-checked-record-python-provenance.mjs";

export {
	inheritedCheckedRecordPythonEvidence
} from "./inherited-checked-record-python-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const inheritedCheckedRecordPythonEvidenceSha256
	= "0537016f9dc5e486ef864b3c2be179557a542f0e34c57ca9bc52ac41ad8d37ac";

const controlKeys = [
	"recordControls", "resourceControls", "environmentControls"
	, "packageControls", "modelControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 7
	, environmentControls: 44, packageControls: 4
	, modelControls: mode === "full" ? 6 : 5
});
const safePath = path => typeof path === "string" && path.length > 0
	&& !path.startsWith("/") && !path.includes("\\")
	&& posix.normalize(path) === path
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const cached = new Map();

/**
 * Verify every archived byte, source snapshot, TAP stream, report, and control.
 *
 * @param read - Repository-relative archive byte reader.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkInheritedCheckedRecordPythonEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cached.has(controls)) return cached.get(controls);
	const checking = (async () => {
		const revisions = inheritedCheckedRecordPythonPinnedRevisions();
		assert.match(inheritedCheckedRecordPythonEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the inherited Python archive index first");
		const indexBytes = Buffer.from(await read(
			`${inheritedCheckedRecordPythonEvidence}/index.json`));
		assert.equal(sha256(indexBytes)
			, inheritedCheckedRecordPythonEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = inheritedCheckedRecordLaneFiles(
			read, inheritedCheckedRecordPythonEvidence);
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "files", "floor", "hostedRun"
			, "interpreters", "kind", "limitations", "loadCeiling"
			, "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind
			, "inherited-checked-record-python-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling
			, inheritedCheckedRecordPythonEvidenceLoadCeiling);
		assert.equal(index.floor, inheritedCheckedRecordPythonEvidenceFloor);
		assert.deepEqual(Object.keys(index.runtime).sort()
			, ["arch", "glibc", "platform"]);
		assert.equal(index.runtime.platform, "linux");
		assert.equal(index.runtime.arch, "x64");
		assert.match(index.runtime.glibc, /^2\.[0-9]+$/u);
		assert.ok(Number(index.runtime.glibc.split(".")[1]) >= 38);
			assert.deepEqual(index.interpreters.map(item => item.minor)
				, inheritedCheckedRecordPythonMinors);
			for(const [position, item] of index.interpreters.entries())
				assertInheritedCheckedRecordPythonInterpreter(
					item, inheritedCheckedRecordPythonMinors[position]);
		assert.deepEqual(Object.keys(index.hostedRun).sort()
			, ["artifact", "repository", "runId", "url"]);
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.ok(Number.isSafeInteger(index.hostedRun.runId)
			&& index.hostedRun.runId > 0);
		assert.equal(index.hostedRun.url
			, `https://github.com/seanmorris/lean-bridge/actions/runs/${index.hostedRun.runId}`);
		assert.deepEqual(Object.keys(index.hostedRun.artifact).sort()
			, ["bytes", "id", "name"]);
		assert.ok(Number.isSafeInteger(index.hostedRun.artifact.id)
			&& index.hostedRun.artifact.id > 0);
		assert.ok(Number.isSafeInteger(index.hostedRun.artifact.bytes)
			&& index.hostedRun.artifact.bytes > 0);
		assert.equal(index.hostedRun.artifact.name
			, `inherited-checked-record-python-${revisions.producer}`);
		assert.ok(Array.isArray(index.limitations)
			&& index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort()
				, ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path)
				, entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0);
			previous = entry.path;
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			await files.authenticate(entry);
		}
		const get = files.get;
		const selectedSources
			= await inheritedCheckedRecordPythonSelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(await get(path)
				, inheritedCheckedRecordPythonEvidenceOriginal(
					source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, inheritedCheckedRecordPythonSelections);
		const accepted = [];
		for(const [position, run] of index.runs.entries())
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "archiveSha256", "controls", "label", "mode"
				, "recordCount", "reportSha256", "route", "tapSha256"
				, "verificationSha256"
			].sort());
			const label = `${run.route}-${run.mode}`;
			assert.equal(run.label, label);
			const prefix = `${label}/records/`, records = new Map();
			for(const path of files.paths(prefix))
				records.set(path.slice(prefix.length), path);
			assert.equal(run.recordCount, records.size);
			const originalRead = async path => {
				assert.ok(records.has(path), path);
				return get(records.get(path));
			};
			const tap = await get(`${label}/run.tap`);
			assertInheritedCheckedRecordPythonCiTap(
				tap.toString(), run.route, run.mode);
			const checked = await checkInheritedCheckedRecordPythonCiRecords({
				route: run.route, mode: run.mode, producer: revisions.producer
				, directory: `/archive/${label}/records`
				, tap: `/archive/${label}/run.tap`, glibc: index.floor
				, python311: index.interpreters[0].binary
				, python312: index.interpreters[1].binary
			}, {
				tap: tap.toString(), read: originalRead, runtime: index.runtime
				, interpreters: index.interpreters
			});
			assert.deepEqual(run.accepted, checked);
			assert.equal(run.archiveSha256, checked.archiveSha256);
			assert.equal(run.reportSha256
				, sha256(await get(prefix + "report.json")));
			assert.equal(run.tapSha256, sha256(tap));
			const verification = await get(`${label}/verification.json`);
			assert.equal(verification.toString(), canonicalJson(checked));
			assert.equal(run.verificationSha256, sha256(verification));
			const controlsPath = `${label}/controls.json`;
			const controlCounts = expectedControls(checked.records, run.mode);
			assert.deepEqual(run.controls, controlCounts);
			assert.deepEqual(json(await get(controlsPath), controlsPath)
				, controlCounts);
			if(controls === "all"
				|| controls === "representative" && position === 0) {
				const replay = await checkInheritedCheckedRecordPythonControls(
					originalRead, {
						route: run.route, mode: run.mode
						, producerCommit: revisions.producer
						, runtime: index.runtime, floor: index.floor
					}
				);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key =>
					[key, replay[key]])), controlCounts);
				}
			const diskPaths = [...checked.recordPaths].sort();
			assert.deepEqual([...records.keys()].sort(), diskPaths);
			expectedPaths.push(`${label}/run.tap`
				, `${label}/verification.json`, controlsPath
				, ...diskPaths.map(path => prefix + path));
			accepted.push(checked);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, selections: accepted, runtime: index.runtime
			, interpreters: index.interpreters
			, hostedRun: index.hostedRun, files: index.files
			, controls, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached.set(controls, checking);
	return checking;
};
