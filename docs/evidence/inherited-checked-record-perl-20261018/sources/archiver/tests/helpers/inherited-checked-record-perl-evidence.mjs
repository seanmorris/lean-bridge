/**
 * Authenticate the immutable hosted inherited checked-record Perl archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertCheckedRecordPerlIdentity } from "./checked-record-perl-install.mjs";
import {
	assertInheritedCheckedRecordPerlCiTap
	, checkInheritedCheckedRecordPerlCiRecords
} from "./inherited-checked-record-perl-ci-report.mjs";
import {
	checkInheritedCheckedRecordPerlControls
} from "./inherited-checked-record-perl-controls.mjs";
import {
	inheritedCheckedRecordPerlEvidenceOriginal
} from "./inherited-checked-record-perl-evidence-sources.mjs";
import {
	inheritedCheckedRecordPerlEvidence
	, inheritedCheckedRecordPerlEvidenceFloor
	, inheritedCheckedRecordPerlEvidenceLoadCeiling
	, inheritedCheckedRecordPerlPinnedRevisions
	, inheritedCheckedRecordPerlSelectedSources
	, inheritedCheckedRecordPerlSelections
} from "./inherited-checked-record-perl-provenance.mjs";

export {
	inheritedCheckedRecordPerlEvidence
} from "./inherited-checked-record-perl-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const inheritedCheckedRecordPerlEvidenceSha256 = null;

const controlKeys = [
	"recordControls", "resourceControls", "interpreterControls"
	, "modelControls", "executionControls", "packageControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 7, interpreterControls: 4
	, modelControls: mode === "full" ? 6 : 5
	, executionControls: 12, packageControls: 4
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
 * Verify every archived byte, source snapshot, TAP stream, report and control.
 *
 * @param read - Repository-relative archive byte reader.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkInheritedCheckedRecordPerlEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cached.has(controls)) return cached.get(controls);
	const checking = (async () => {
		const revisions = inheritedCheckedRecordPerlPinnedRevisions();
		assert.match(inheritedCheckedRecordPerlEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the inherited Perl archive index first");
		const indexBytes = Buffer.from(await read(
			`${inheritedCheckedRecordPerlEvidence}/index.json`
		));
		assert.equal(sha256(indexBytes)
			, inheritedCheckedRecordPerlEvidenceSha256);
		const index = json(indexBytes, "index.json");
		const files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "files", "floor", "hostedRun"
			, "interpreters", "kind", "limitations", "loadCeiling"
			, "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind
			, "inherited-checked-record-perl-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling
			, inheritedCheckedRecordPerlEvidenceLoadCeiling);
		assert.equal(index.floor, inheritedCheckedRecordPerlEvidenceFloor);
		assert.deepEqual(index.runtime, {
			platform: "linux", arch: "x64", glibc: index.runtime.glibc
		});
		assert.match(index.runtime.glibc, /^2\.[0-9]+$/u);
		assert.ok(Number(index.runtime.glibc.split(".")[1]) >= 38);
		assert.deepEqual(index.interpreters.map(item => item.configuration), [
			"5.36.3-threaded", "5.36.3-unthreaded"
			, "5.38.2-threaded", "5.38.2-unthreaded"
		]);
		for(const item of index.interpreters)
		{
			assertCheckedRecordPerlIdentity(item.configuration, item.identity);
			assert.match(item.executable.sha256, /^[a-f0-9]{64}$/u);
			assert.ok(Number.isSafeInteger(item.executable.bytes)
				&& item.executable.bytes > 0);
		}
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
			, `inherited-checked-record-perl-${revisions.producer}`);
		assert.ok(Array.isArray(index.limitations)
			&& index.limitations.length === 7
			&& index.limitations.every(item =>
				typeof item === "string" && item.length));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort()
				, ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0);
			previous = entry.path;
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				`${inheritedCheckedRecordPerlEvidence}/${entry.path}`
			));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path);
			assert.ok(Buffer.isBuffer(value), path);
			return value;
		};
		const selectedSources
			= await inheritedCheckedRecordPerlSelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path)
				, inheritedCheckedRecordPerlEvidenceOriginal(
					source.revision, source.path
				), path);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, inheritedCheckedRecordPerlSelections);
		const accepted = [];
		for(const [position, run] of index.runs.entries())
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "controls", "label", "mode", "recordCount"
				, "reportSha256", "route", "tapSha256"
				, "verificationSha256"
			].sort());
			const label = `${run.route}-${run.mode}`;
			assert.equal(run.label, label);
			const prefix = `${label}/records/`;
			const records = new Map();
			for(const [path, bytes] of files)
				if(path.startsWith(prefix))
					records.set(path.slice(prefix.length), bytes);
			assert.equal(run.recordCount, records.size);
			const originalRead = async path => {
				assert.ok(records.has(path), path);
				return records.get(path);
			};
			const tap = get(`${label}/run.tap`);
			assertInheritedCheckedRecordPerlCiTap(
				tap.toString(), run.route, run.mode
			);
			const checkerOptions = {
				route: run.route, mode: run.mode, producer: revisions.producer
				, directory: `/archive/${label}/records`
				, tap: tap.toString(), glibc: index.floor
				, maxLoad: index.loadCeiling, runtime: index.runtime
				, interpreters: index.interpreters
				, paths: [...records.keys()]
			};
			const checked = await checkInheritedCheckedRecordPerlCiRecords({
				...checkerOptions, read: originalRead
			});
			assert.deepEqual(run.accepted, checked);
			assert.equal(run.reportSha256
				, sha256(get(prefix + "report.json")));
			assert.equal(run.tapSha256, sha256(tap));
			const verification = get(`${label}/verification.json`);
			assert.equal(verification.toString(), canonicalJson(checked));
			assert.equal(run.verificationSha256, sha256(verification));
			const controlsPath = `${label}/controls.json`;
			const controlCounts = expectedControls(
				checked.records.length, run.mode
			);
			assert.deepEqual(run.controls, controlCounts);
			assert.deepEqual(json(get(controlsPath), controlsPath)
				, controlCounts);
			if(controls === "all"
				|| controls === "representative" && position === 0) {
				const replay = await checkInheritedCheckedRecordPerlControls(
					originalRead, checkerOptions
				);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key =>
					[key, replay[key]])), controlCounts);
				}
			const diskPaths = [...records.keys()].sort();
			assert.deepEqual(diskPaths, [...checked.records, ...checked.handoff]
				.map(item => item.path).sort());
			expectedPaths.push(
				`${label}/run.tap`, `${label}/verification.json`, controlsPath
				, ...diskPaths.map(path => prefix + path)
			);
			accepted.push(checked);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, selections: accepted, runtime: index.runtime
			, interpreters: index.interpreters, hostedRun: index.hostedRun
			, files: index.files, controls, supportPromoted: false
			, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached.set(controls, checking);
	return checking;
};
