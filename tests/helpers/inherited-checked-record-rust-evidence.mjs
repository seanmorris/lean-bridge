/**
 * Authenticate the immutable hosted inherited checked-record Rust archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkInheritedCheckedRecordRustControls
} from "./inherited-checked-record-rust-controls.mjs";
import {
	assertInheritedCheckedRecordRustCiTap
	, checkInheritedCheckedRecordRustCiRecords
	, inheritedCheckedRecordRustCiReader
} from "./inherited-checked-record-rust-ci-report.mjs";
import {
	inheritedCheckedRecordRustRecords
} from "./inherited-checked-record-rust-report.mjs";
import {
	inheritedCheckedRecordRustEvidence
	, inheritedCheckedRecordRustEvidenceFloor
	, inheritedCheckedRecordRustEvidenceLoadCeiling
	, inheritedCheckedRecordRustPinnedRevisions
	, inheritedCheckedRecordRustSelectedSources
	, inheritedCheckedRecordRustSelections
} from "./inherited-checked-record-rust-provenance.mjs";
import {
	inheritedCheckedRecordRustOriginal
} from "./inherited-checked-record-rust-evidence-sources.mjs";

export { inheritedCheckedRecordRustEvidence } from "./inherited-checked-record-rust-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const inheritedCheckedRecordRustEvidenceSha256
	= "637341e2f937ed721f0ff640655503a6963f93d4210c04ea29f50be75d1eba30";

const controlKeys = [
	"recordControls", "resourceControls", "environmentControls"
	, "packageControls", "modelControls", "executionControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 8
	, environmentControls: mode === "full" ? 60 : 61
	, packageControls: 6, modelControls: mode === "full" ? 6 : 5
	, executionControls: 30
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
export const checkInheritedCheckedRecordRustEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cached.has(controls)) return cached.get(controls);
	const checking = (async () => {
		const revisions = inheritedCheckedRecordRustPinnedRevisions();
		assert.match(inheritedCheckedRecordRustEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the inherited Rust archive index first");
		const indexBytes = Buffer.from(await read(
			`${inheritedCheckedRecordRustEvidence}/index.json`));
		assert.equal(sha256(indexBytes), inheritedCheckedRecordRustEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "files", "floor", "hostedRun"
			, "kind", "limitations", "loadCeiling", "producerCommit", "runs"
			, "runtime", "schemaVersion", "selectedSources", "toolchain"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "inherited-checked-record-rust-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling, inheritedCheckedRecordRustEvidenceLoadCeiling);
		assert.equal(index.floor, inheritedCheckedRecordRustEvidenceFloor);
		assert.deepEqual(Object.keys(index.runtime).sort()
			, ["arch", "glibc", "platform"]);
		assert.equal(index.runtime.platform, "linux");
		assert.equal(index.runtime.arch, "x64");
		assert.match(index.runtime.glibc, /^2\.[0-9]+$/u);
		assert.ok(Number(index.runtime.glibc.split(".")[1]) >= 38);
		assert.deepEqual(Object.keys(index.hostedRun).sort()
			, ["repository", "runId", "url"]);
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.ok(Number.isSafeInteger(index.hostedRun.runId)
			&& index.hostedRun.runId > 0);
		assert.equal(index.hostedRun.url
			, `https://github.com/seanmorris/lean-bridge/actions/runs/${index.hostedRun.runId}`);
		assert.ok(Array.isArray(index.limitations)
			&& index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0);
			previous = entry.path;
			const value = Buffer.from(await read(
				`${inheritedCheckedRecordRustEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path);
			assert.ok(Buffer.isBuffer(value), path);
			return value;
		};
		const selectedSources = await inheritedCheckedRecordRustSelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), inheritedCheckedRecordRustOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, inheritedCheckedRecordRustSelections);
		const accepted = [];
		for(const [position, run] of index.runs.entries())
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "controls", "label", "mode", "recordCount"
				, "reportSha256", "route", "tapSha256", "verificationSha256"
			].sort());
			const label = `${run.route}-${run.mode}`;
			assert.equal(run.label, label);
			const prefix = `${label}/records/`, records = new Map();
			for(const [path, bytes] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), bytes);
			const originalRead = async path => {
				assert.ok(records.has(path), path); return records.get(path);
			};
			const recordRead = await inheritedCheckedRecordRustCiReader(originalRead);
			const tap = get(`${label}/run.tap`);
			const options = {
				route: run.route, mode: run.mode, producer: revisions.producer
				, directory: "records", tap: "run.tap", glibc: index.floor
				, rustc: index.toolchain.rustc.command
				, cargo: index.toolchain.cargo.command
			};
			const checked = await checkInheritedCheckedRecordRustCiRecords(options, {
				tap: tap.toString(), read: recordRead, runtime: index.runtime
				, toolchain: index.toolchain
			});
			assert.deepEqual(run.accepted, checked);
			const crate = json(get(prefix + "crate.json"), prefix + "crate.json");
			const dependencies = json(get(prefix + "dependencies.json")
				, prefix + "dependencies.json");
			const recordPaths = inheritedCheckedRecordRustRecords(
				run.route, crate, dependencies);
			assert.equal(run.recordCount, recordPaths.length);
			assert.equal(records.size, recordPaths.length);
			assert.deepEqual([...records.keys()].sort(), recordPaths.sort());
			assert.equal(run.reportSha256, sha256(get(prefix + "report.json")));
			assert.equal(run.tapSha256, sha256(tap));
			assertInheritedCheckedRecordRustCiTap(tap.toString(), run.route, run.mode);
			const verification = get(`${label}/verification.json`);
			assert.equal(verification.toString(), canonicalJson(checked));
			assert.equal(run.verificationSha256, sha256(verification));
			const controlsPath = `${label}/controls.json`;
			const controlCounts = expectedControls(recordPaths.length, run.mode);
			assert.deepEqual(run.controls, controlCounts);
			assert.deepEqual(json(get(controlsPath), controlsPath), controlCounts);
			if(controls === "all" || controls === "representative" && position === 0)
			{
				const controlOptions = {
					route: run.route, mode: run.mode
					, producerCommit: revisions.producer
					, runtime: index.runtime, floor: index.floor
					, toolchain: index.toolchain
				};
				const replay = await checkInheritedCheckedRecordRustControls(
					recordRead, controlOptions
				);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key =>
					[key, replay[key]])), controlCounts);
			}
			expectedPaths.push(`${label}/run.tap`, `${label}/verification.json`
				, controlsPath, ...recordPaths.map(path => prefix + path));
			accepted.push(checked);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, selections: accepted, runtime: index.runtime
			, toolchain: index.toolchain, hostedRun: index.hostedRun
			, files: index.files, controls
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached.set(controls, checking);
	return checking;
};
