/**
 * Authenticate the immutable nested checked-record Python archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNestedCheckedRecordPythonControls } from "./nested-checked-record-python-controls.mjs";
import { checkNestedCheckedRecordPythonReport } from "./nested-checked-record-python-report.mjs";
import {
	assertNestedCheckedRecordPythonEvidenceTap
	, nestedCheckedRecordPythonEvidence
	, nestedCheckedRecordPythonEvidenceSources
	, nestedCheckedRecordPythonInterpreters
	, nestedCheckedRecordPythonLoadCeiling
	, nestedCheckedRecordPythonOriginal
	, nestedCheckedRecordPythonProducer
	, nestedCheckedRecordPythonRuntime
	, nestedCheckedRecordPythonSelections
	, nestedCheckedRecordPythonVerifier
} from "./nested-checked-record-python-provenance.mjs";

export { nestedCheckedRecordPythonEvidence } from "./nested-checked-record-python-provenance.mjs";
export const nestedCheckedRecordPythonEvidenceSha256
	= "5897872bbfbb8193ef5164e76aecf99b0caedb533683991a23ea9af6309986f1";

const controlKeys = ["recordControls", "resourceControls", "environmentControls"
	, "packageControls", "modelControls"];
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_.+$/[\]-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 7, environmentControls: 44
	, packageControls: 4, modelControls: mode === "full" ? 6 : 5
});
const cachedChecks = new Map();

/**
 * Reconcile every retained wheel, record, source, execution, and control.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkNestedCheckedRecordPythonEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cachedChecks.has(controls))
		return cachedChecks.get(controls);
	const checking = (async () => {
		const bytes = Buffer.from(await read(nestedCheckedRecordPythonEvidence + "/index.json"));
		assert.equal(sha256(bytes), nestedCheckedRecordPythonEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"checkerCommit", "files", "interpreters", "kind"
			, "limitations", "loadCeiling"
			, "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources", "tapSha256"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "nested-checked-record-python-installed-v1");
		assert.equal(index.producerCommit, nestedCheckedRecordPythonProducer);
		assert.equal(index.checkerCommit, nestedCheckedRecordPythonVerifier);
		assert.equal(index.loadCeiling, nestedCheckedRecordPythonLoadCeiling);
		assert.deepEqual(index.runtime, nestedCheckedRecordPythonRuntime);
		assert.deepEqual(index.interpreters, nestedCheckedRecordPythonInterpreters);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item.length));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(nestedCheckedRecordPythonEvidence + "/" + entry.path));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path); files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const expectedPaths = [], selectedSources = await nestedCheckedRecordPythonEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const retained = `sources/${source.role}/${source.path}`; expectedPaths.push(retained);
			assert.deepEqual(get(retained), nestedCheckedRecordPythonOriginal(source.revision, source.path)
				, `${source.role}:${source.path}`);
		}
		const tap = get("producer/run.tap"); expectedPaths.push("producer/run.tap");
		assert.equal(index.tapSha256, sha256(tap)); assertNestedCheckedRecordPythonEvidenceTap(tap.toString());
		assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nestedCheckedRecordPythonSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, mode] = nestedCheckedRecordPythonSelections[position], label = `${route}-${mode}`;
			assert.deepEqual(Object.keys(run).sort(), [
				"archiveSha256", "controls", "executions", "label", "loadCeiling"
				, "mode", "records", "reportSha256", "route"
			].sort());
			assert.equal(run.label, label); assert.equal(run.route, route); assert.equal(run.mode, mode);
			assert.equal(run.loadCeiling, nestedCheckedRecordPythonLoadCeiling);
			const prefix = `${label}/records/`, recordRead = path => Promise.resolve(get(prefix + path));
			const result = await checkNestedCheckedRecordPythonReport(recordRead, {
				route, mode, producerCommit: nestedCheckedRecordPythonProducer
				, runtime: nestedCheckedRecordPythonRuntime, floor: "2.36"
			});
			assert.equal(run.archiveSha256, result.archiveSha256);
			assert.equal(run.reportSha256, result.reportSha256);
			assert.equal(run.executions, result.executions); assert.equal(run.records, result.records);
			const controlCounts = expectedControls(result.records, mode);
			assert.deepEqual(run.controls, controlCounts);
			const retainedControls = json(get(`${label}/controls.json`), `${label}/controls.json`);
			assert.deepEqual(retainedControls, controlCounts); expectedPaths.push(`${label}/controls.json`);
			if(controls === "all" || controls === "representative" && position === 0)
			{
				const replay = await checkNestedCheckedRecordPythonControls(recordRead, {
					route, mode, producerCommit: nestedCheckedRecordPythonProducer
					, runtime: nestedCheckedRecordPythonRuntime, floor: "2.36"
				});
				assert.deepEqual(Object.fromEntries(controlKeys.map(key => [key, replay[key]])), controlCounts);
			}
			expectedPaths.push(...result.recordPaths.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit, checkerCommit: index.checkerCommit
			, selections: checked, files: index.files
			, selectedSources: index.selectedSources
			, controls, installedProfiles: ["python"], supportPromoted: false
			, hostedAcceptance: false
		};
	})();
	if(read === readFile) cachedChecks.set(controls, checking);
	return checking;
};
