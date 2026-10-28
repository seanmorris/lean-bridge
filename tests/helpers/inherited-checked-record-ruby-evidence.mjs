/**
 * Authenticate the immutable hosted inherited checked-record Ruby archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { inheritedCheckedRecordLaneFiles } from "./inherited-checked-record-lane-files.mjs";
import {
	assertInheritedCheckedRecordRubyCiTap
	, checkInheritedCheckedRecordRubyCiRecords
} from "./inherited-checked-record-ruby-ci-report.mjs";
import {
	checkInheritedCheckedRecordRubyControls
} from "./inherited-checked-record-ruby-controls.mjs";
import {
	assertInheritedCheckedRecordRubyInterpreter
} from "./inherited-checked-record-ruby-environment-records.mjs";
import {
	inheritedCheckedRecordRubyEvidenceOriginal
} from "./inherited-checked-record-ruby-evidence-sources.mjs";
import {
	inheritedCheckedRecordRubyEvidence
	, inheritedCheckedRecordRubyEvidenceFloor
	, inheritedCheckedRecordRubyEvidenceLoadCeiling
	, inheritedCheckedRecordRubyPinnedRevisions
	, inheritedCheckedRecordRubySelectedSources
	, inheritedCheckedRecordRubySelections
} from "./inherited-checked-record-ruby-provenance.mjs";

export {
	inheritedCheckedRecordRubyEvidence
} from "./inherited-checked-record-ruby-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const inheritedCheckedRecordRubyEvidenceSha256
	= "16c66b83949bf95444ec28a180a3dff4ebeae784cb65fed7a2d78cc9d88eb088";

const controlKeys = [
	"recordControls", "resourceControls", "environmentControls"
	, "packageControls", "modelControls", "executionControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 7
	, environmentControls: 12, packageControls: 4
	, modelControls: mode === "full" ? 6 : 5, executionControls: 20
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
export const checkInheritedCheckedRecordRubyEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cached.has(controls)) return cached.get(controls);
	const checking = (async () => {
		const revisions = inheritedCheckedRecordRubyPinnedRevisions();
		assert.match(inheritedCheckedRecordRubyEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the inherited Ruby archive index first");
		const indexBytes = Buffer.from(await read(
			`${inheritedCheckedRecordRubyEvidence}/index.json`));
		assert.equal(sha256(indexBytes)
			, inheritedCheckedRecordRubyEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = inheritedCheckedRecordLaneFiles(
			read, inheritedCheckedRecordRubyEvidence);
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "files", "floor", "hostedRun"
			, "interpreter", "kind", "limitations", "loadCeiling"
			, "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind
			, "inherited-checked-record-ruby-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling
			, inheritedCheckedRecordRubyEvidenceLoadCeiling);
		assert.equal(index.floor, inheritedCheckedRecordRubyEvidenceFloor);
		assert.deepEqual(Object.keys(index.runtime).sort()
			, ["arch", "glibc", "platform"]);
		assert.equal(index.runtime.platform, "linux");
		assert.equal(index.runtime.arch, "x64");
		assert.match(index.runtime.glibc, /^2\.[0-9]+$/u);
		assert.ok(Number(index.runtime.glibc.split(".")[1]) >= 38);
		const rubyVersion = JSON.parse(index.interpreter.run.stdout).version;
		assertInheritedCheckedRecordRubyInterpreter(
			index.interpreter, rubyVersion);
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
			, `inherited-checked-record-ruby-${revisions.producer}`);
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
			= await inheritedCheckedRecordRubySelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(await get(path)
				, inheritedCheckedRecordRubyEvidenceOriginal(
					source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, inheritedCheckedRecordRubySelections);
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
			assertInheritedCheckedRecordRubyCiTap(
				tap.toString(), run.route, run.mode);
			const checked = await checkInheritedCheckedRecordRubyCiRecords({
				route: run.route, mode: run.mode, producer: revisions.producer
				, directory: `/archive/${label}/records`
				, tap: `/archive/${label}/run.tap`, glibc: index.floor
				, ruby: index.interpreter.command
			}, {
				tap: tap.toString(), read: originalRead, runtime: index.runtime
				, interpreter: index.interpreter
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
				const replay = await checkInheritedCheckedRecordRubyControls(
					originalRead, {
						route: run.route, mode: run.mode
						, producerCommit: revisions.producer
						, runtime: index.runtime, floor: index.floor
						, rubyVersion
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
			, interpreter: index.interpreter
			, hostedRun: index.hostedRun, files: index.files
			, controls, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached.set(controls, checking);
	return checking;
};
