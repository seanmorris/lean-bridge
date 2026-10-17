/**
 * Authenticate the immutable recursive checked-record Rust archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordRustControls } from "./recursive-checked-record-rust-controls.mjs";
import {
	assertRecursiveCheckedRecordRustCiTap, recursiveCheckedRecordRustCiReader
} from "./recursive-checked-record-rust-ci-report.mjs";
import { checkRecursiveCheckedRecordRustReport, recursiveCheckedRecordRustRecords } from "./recursive-checked-record-rust-report.mjs";
import {
	recursiveCheckedRecordRustEvidence
	, recursiveCheckedRecordRustEvidenceFloor
	, recursiveCheckedRecordRustEvidenceLoadCeiling
	, recursiveCheckedRecordRustEvidenceOriginal
	, recursiveCheckedRecordRustEvidenceRuntime
	, recursiveCheckedRecordRustEvidenceSources
	, recursiveCheckedRecordRustEvidenceToolchain
	, recursiveCheckedRecordRustProducer
	, recursiveCheckedRecordRustSelections
	, recursiveCheckedRecordRustVerifier
} from "./recursive-checked-record-rust-provenance.mjs";

export { recursiveCheckedRecordRustEvidence } from "./recursive-checked-record-rust-provenance.mjs";
export const recursiveCheckedRecordRustEvidenceSha256
	= "df98b1d864269ad42cde061c226e7b2c3379b46f8e32dc4b4a3a466560019dd5";

const controlKeys = ["recordControls", "resourceControls"
	, "environmentControls", "packageControls", "modelControls"
	, "executionControls"];
const safePath = path => typeof path === "string" && path.length > 0
	&& !path.startsWith("/") && !path.includes("\\")
	&& posix.normalize(path) === path
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const expectedControls = records => ({
	recordControls: records * 2, resourceControls: 8
	, environmentControls: 60
	, packageControls: 7, modelControls: 8
	, executionControls: 30
});
const cachedChecks = new Map();

/**
 * Reconcile every retained crate, dependency, record, source and execution.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells or no controls.
 */
export const checkRecursiveCheckedRecordRustEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cachedChecks.has(controls))
		return cachedChecks.get(controls);
	const checking = (async () => {
		const bytes = Buffer.from(await read(
			recursiveCheckedRecordRustEvidence + "/index.json"
		));
		assert.equal(sha256(bytes), recursiveCheckedRecordRustEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"checkerCommit", "diskFloorBytes", "files", "floor", "kind"
			, "limitations", "loadCeiling", "producerCommit", "runs"
			, "runtime", "schemaVersion", "selectedSources", "toolchain"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "recursive-checked-record-rust-installed-v1");
		assert.equal(index.producerCommit, recursiveCheckedRecordRustProducer);
		assert.equal(index.checkerCommit, recursiveCheckedRecordRustVerifier);
		assert.equal(index.loadCeiling, recursiveCheckedRecordRustEvidenceLoadCeiling);
		assert.equal(index.diskFloorBytes, 2 * 1024 ** 3);
		assert.equal(index.floor, recursiveCheckedRecordRustEvidenceFloor);
		assert.deepEqual(index.runtime, recursiveCheckedRecordRustEvidenceRuntime);
		assert.deepEqual(index.toolchain, recursiveCheckedRecordRustEvidenceToolchain);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 8
			&& index.limitations.every(item => typeof item === "string" && item.length));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				recursiveCheckedRecordRustEvidence + "/" + entry.path
			));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path);
			assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const expectedPaths = [];
		const selectedSources = await recursiveCheckedRecordRustEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const retained = `sources/${source.role}/${source.path}`;
			expectedPaths.push(retained);
			assert.deepEqual(get(retained), recursiveCheckedRecordRustEvidenceOriginal(
				source.revision, source.path
			), `${source.role}:${source.path}`);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.fixture])
			, recursiveCheckedRecordRustSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, fixture] = recursiveCheckedRecordRustSelections[position];
			const label = `${route}-${fixture}`;
			assert.deepEqual(Object.keys(run).sort(), [
				"artifacts", "controls", "counts", "dependencyArchiveSha256"
				, "dispatchObserved", "executions", "generatorModules", "label"
				, "loadCeiling", "fixture", "records", "reportSha256", "route"
				, "tapSha256", "verificationSha256"
			].sort());
			assert.equal(run.label, label); assert.equal(run.route, route);
			assert.equal(run.fixture, fixture);
			assert.equal(run.loadCeiling, recursiveCheckedRecordRustEvidenceLoadCeiling);
			const prefix = `${label}/records/`;
			const recordRead = await recursiveCheckedRecordRustCiReader(
				path => Promise.resolve(get(prefix + path))
			);
			const result = await checkRecursiveCheckedRecordRustReport(recordRead, {
				route, fixture, producerCommit: recursiveCheckedRecordRustProducer
				, runtime: index.runtime, floor: index.floor
				, toolchain: index.toolchain
			});
			const crate = json(get(prefix + "crate.json"), prefix + "crate.json");
			const dependencies = json(get(prefix + "dependencies.json")
				, prefix + "dependencies.json");
			const records = recursiveCheckedRecordRustRecords(
				route, fixture, crate, dependencies
			);
			assert.equal(run.records, records.length);
			assert.equal(result.records, records.length);
			assert.equal(run.reportSha256, sha256(get(prefix + "report.json")));
			assert.equal(run.dependencyArchiveSha256, dependencies.sha256);
			const tapPath = `${label}/run.tap`, tap = get(tapPath).toString();
			assert.equal(run.tapSha256, sha256(get(tapPath)));
			assertRecursiveCheckedRecordRustCiTap(tap, route, fixture);
			const verificationPath = `${label}/verification.json`;
			const verification = json(get(verificationPath), verificationPath);
			assert.equal(run.verificationSha256, sha256(get(verificationPath)));
			assert.deepEqual(verification, result);
			const report = json(get(prefix + "report.json"), prefix + "report.json");
			assert.deepEqual(run.artifacts, report.receipt.packages[0].artifacts);
			for(const key of ["counts", "executions", "generatorModules"
				, "dispatchObserved", "loadCeiling"])
				assert.deepEqual(run[key], result[key], `${label} ${key}`);
			const controlCounts = expectedControls(records.length);
			assert.deepEqual(run.controls, controlCounts);
			const controlsPath = `${label}/controls.json`;
			assert.deepEqual(json(get(controlsPath), controlsPath), controlCounts);
			if(controls === "all" || controls === "representative" && position === 0)
			{
				const replay = await checkRecursiveCheckedRecordRustControls(recordRead, {
					route, fixture, producerCommit: recursiveCheckedRecordRustProducer
					, runtime: index.runtime, floor: index.floor
					, toolchain: index.toolchain
				});
				assert.deepEqual(Object.fromEntries(controlKeys.map(key =>
					[key, replay[key]])), controlCounts);
			}
			expectedPaths.push(tapPath, verificationPath, controlsPath
				, ...records.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts
				, artifacts: structuredClone(run.artifacts)
				, dependencyArchiveSha256: run.dependencyArchiveSha256 });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit
			, checkerCommit: index.checkerCommit
			, selections: checked, files: index.files
			, selectedSources: index.selectedSources, controls
			, installedProfiles: ["rust"], supportPromoted: false
			, hostedAcceptance: false
		};
	})();
	if(read === readFile) cachedChecks.set(controls, checking);
	return checking;
};
