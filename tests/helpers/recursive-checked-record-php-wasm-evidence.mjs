/**
 * Authenticate the immutable recursive checked-record PHP-Wasm evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordPhpWasmCiRecords } from "./recursive-checked-record-php-wasm-ci-report.mjs";
import { checkRecursiveCheckedRecordPhpWasmReport } from "./recursive-checked-record-php-wasm-report.mjs";
import {
	recursiveCheckedRecordPhpWasmEvidence, recursiveCheckedRecordPhpWasmEvidenceLoadCeiling
	, recursiveCheckedRecordPhpWasmEvidenceSources, recursiveCheckedRecordPhpWasmExpectedControls
	, recursiveCheckedRecordPhpWasmOriginal, recursiveCheckedRecordPhpWasmPinnedRevisions
	, recursiveCheckedRecordPhpWasmSelections
} from "./recursive-checked-record-php-wasm-provenance.mjs";

export { recursiveCheckedRecordPhpWasmEvidence } from "./recursive-checked-record-php-wasm-provenance.mjs";
/** Pinned to the index the archive script prints; null refuses every check. */
export const recursiveCheckedRecordPhpWasmEvidenceSha256
	= "f90022b0ec7d0b5664e9674f627afe6e11c17d56c258e2dc0cc36bdf1e6201ce";

const cellFiles = ["run.tap", "runtime-after.json", "runtime-after.log", "runtime-before.json", "runtime-before.log", "verification.json"];
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_@.+/-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const cachedChecks = new Map();

/**
 * Reconcile every retained record, runtime snapshot, TAP, checker output, source and control.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - "representative" replays every control on the first cell, "all" on every cell, "none" only the report.
 */
export const checkRecursiveCheckedRecordPhpWasmEvidence = async (read = readFile, { controls = "representative" } = {}) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cachedChecks.has(controls)) return cachedChecks.get(controls);
	const checking = (async () => {
		const { producer, verifier } = recursiveCheckedRecordPhpWasmPinnedRevisions();
		assert.match(recursiveCheckedRecordPhpWasmEvidenceSha256 ?? "", /^[a-f0-9]{64}$/u, "Pin the archived index first");
		const bytes = Buffer.from(await read(recursiveCheckedRecordPhpWasmEvidence + "/index.json"));
		assert.equal(sha256(bytes), recursiveCheckedRecordPhpWasmEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), ["checkerCommit"
			, "diskFloorBytes", "files", "host", "kind", "limitations"
			, "loadCeiling", "producerCommit", "runs", "runtimeIdentity"
			, "runtimeSnapshotSha256", "schemaVersion", "selectedSources"]);
		assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "recursive-checked-record-php-wasm-installed-v1");
		assert.equal(index.producerCommit, producer); assert.equal(index.checkerCommit, verifier);
		assert.equal(index.loadCeiling, recursiveCheckedRecordPhpWasmEvidenceLoadCeiling);
		assert.equal(index.diskFloorBytes, 2 * 1024 ** 3);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 8);
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			const value = Buffer.from(await read(recursiveCheckedRecordPhpWasmEvidence + "/" + entry.path));
			assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const expectedPaths = [];
		assert.deepEqual(index.selectedSources, recursiveCheckedRecordPhpWasmEvidenceSources());
		for(const source of index.selectedSources)
		{
			const retained = `sources/${source.role}/${source.path}`; expectedPaths.push(retained);
			assert.deepEqual(get(retained), recursiveCheckedRecordPhpWasmOriginal(source.revision, source.path), retained);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.fixture]), recursiveCheckedRecordPhpWasmSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, fixture] = recursiveCheckedRecordPhpWasmSelections[position], label = `${route}-${fixture}`;
			assert.deepEqual(Object.keys(run).sort(), ["controls", "counts"
				, "dispatchObserved", "executions", "fixture", "label", "loadCeiling"
				, "packageFiles", "records", "reportSha256", "route"
				, "runtimeSnapshotSha256", "tapSha256", "verificationSha256"]);
			assert.equal(run.label, label); assert.equal(run.route, route);
			assert.equal(run.fixture, fixture);
			assert.equal(run.loadCeiling, recursiveCheckedRecordPhpWasmEvidenceLoadCeiling);
			const prefix = `${label}/records/`, records = new Map();
			for(const path of files.keys()) if(path.startsWith(prefix)) records.set(path.slice(prefix.length), get(path));
			const before = get(`${label}/runtime-before.json`);
			assert.deepEqual(get(`${label}/runtime-after.json`), before);
			assert.equal(sha256(before), index.runtimeSnapshotSha256); assert.equal(run.runtimeSnapshotSha256, index.runtimeSnapshotSha256);
			const runtime = json(before, `${label}/runtime-before.json`);
			assert.equal(runtime.runtime.identity, index.runtimeIdentity); assert.deepEqual(runtime.host, index.host);
			const tap = get(`${label}/run.tap`), verification = get(`${label}/verification.json`);
			assert.equal(run.tapSha256, sha256(tap)); assert.equal(run.verificationSha256, sha256(verification));
			const scope = { route, fixture, producer, directory: "records", tap: "run.tap", runtime: "runtime-before.json" };
			const replay = controls === "all" || controls === "representative" && position === 0;
			// The full checker replays every control; otherwise the report alone re-verifies the records.
			const result = replay
				? await checkRecursiveCheckedRecordPhpWasmCiRecords(scope, { tap: tap.toString(), runtime, records })
				: { ...await checkRecursiveCheckedRecordPhpWasmReport(async path => {
					assert.ok(records.has(path), path); return records.get(path);
				}, { route, fixture, producerCommit: producer })
				, controls: recursiveCheckedRecordPhpWasmExpectedControls(records.size)
				, reportSha256: sha256(records.get("report.json")) };
			assert.deepEqual([...records.keys()].sort(), result.records);
			const expected = recursiveCheckedRecordPhpWasmExpectedControls(result.records.length);
			assert.deepEqual(result.controls, expected); assert.deepEqual(run.controls, expected);
			assert.equal(verification.toString(), canonicalJson(result), `${label} retained checker output`);
			for(const key of ["executions", "dispatchObserved", "reportSha256"]) assert.deepEqual(run[key], result[key], key);
			assert.deepEqual(run.counts, result.counts); assert.equal(run.records, result.records.length);
			assert.deepEqual(run.packageFiles, result.packageFiles);
			expectedPaths.push(...cellFiles.map(path => `${label}/${path}`), ...result.records.map(path => prefix + path));
			checked.push({ ...result, label });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return { producerCommit: producer, checkerCommit: verifier
			, selections: checked, controls
			, installedProfiles: ["php-wasm"], supportPromoted: false
			, hostedAcceptance: false };
	})();
	if(read === readFile) cachedChecks.set(controls, checking);
	return checking;
};
