/**
 * Authenticate the immutable nested checked-record WIT/WASI archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNestedCheckedRecordWitControls } from "./nested-checked-record-wit-controls.mjs";
import { inspectNestedCheckedRecordWitHandoff } from "./nested-checked-record-wit-handoff.mjs";
import { checkNestedCheckedRecordWitReport } from "./nested-checked-record-wit-report.mjs";
import {
	assertNestedCheckedRecordWitEvidenceTap
	, nestedCheckedRecordWitEvidence
	, nestedCheckedRecordWitEvidenceSources
	, nestedCheckedRecordWitLoadCeiling
	, nestedCheckedRecordWitOriginal
	, nestedCheckedRecordWitProducer
	, nestedCheckedRecordWitRuntime
	, nestedCheckedRecordWitSelections
	, nestedCheckedRecordWitTools
	, nestedCheckedRecordWitVerifier
} from "./nested-checked-record-wit-provenance.mjs";

export { nestedCheckedRecordWitEvidence } from "./nested-checked-record-wit-provenance.mjs";
export const nestedCheckedRecordWitEvidenceSha256
	= "aabdb418ac48d1eda4a1a894af7c441df9186b18f7b198e3c09d37d769cf4be7";

const controlKeys = ["recordControls", "executionControls", "toolControls"
	, "resourceControls", "environmentControls", "packageControls"
	, "modelControls"];
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_.+$/[\]-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2, executionControls: 24, toolControls: 12
	, resourceControls: 7, environmentControls: 15, packageControls: 5
	, modelControls: mode === "full" ? 6 : 5
});
const cachedChecks = new Map();

/**
 * Reconcile every retained component archive, record, source, execution and control.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkNestedCheckedRecordWitEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cachedChecks.has(controls))
		return cachedChecks.get(controls);
	const checking = (async () => {
		const bytes = Buffer.from(await read(
			nestedCheckedRecordWitEvidence + "/index.json"
		));
		assert.equal(sha256(bytes), nestedCheckedRecordWitEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"checkerCommit", "files", "kind", "limitations", "loadCeiling"
			, "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources", "tapSha256", "tools"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "nested-checked-record-wit-installed-v1");
		assert.equal(index.producerCommit, nestedCheckedRecordWitProducer);
		assert.equal(index.checkerCommit, nestedCheckedRecordWitVerifier);
		assert.equal(index.loadCeiling, nestedCheckedRecordWitLoadCeiling);
		assert.deepEqual(index.runtime, nestedCheckedRecordWitRuntime);
		assert.deepEqual(index.tools, nestedCheckedRecordWitTools);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 9
			&& index.limitations.every(item =>
				typeof item === "string" && item.length));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				nestedCheckedRecordWitEvidence + "/" + entry.path
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
		const selectedSources = await nestedCheckedRecordWitEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const retained = `sources/${source.role}/${source.path}`;
			expectedPaths.push(retained);
			assert.deepEqual(get(retained), nestedCheckedRecordWitOriginal(
				source.revision, source.path
			), `${source.role}:${source.path}`);
		}
		const tap = get("producer/run.tap");
		expectedPaths.push("producer/run.tap");
		assert.equal(index.tapSha256, sha256(tap));
		assertNestedCheckedRecordWitEvidenceTap(tap.toString());
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, nestedCheckedRecordWitSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, mode] = nestedCheckedRecordWitSelections[position];
			const label = `${route}-${mode}`;
			assert.deepEqual(Object.keys(run).sort(), [
				"archiveSha256", "controls", "executions", "label"
				, "loadCeiling", "mode", "records", "reportSha256", "route"
			].sort());
			assert.equal(run.label, label); assert.equal(run.route, route);
			assert.equal(run.mode, mode);
			assert.equal(run.loadCeiling, nestedCheckedRecordWitLoadCeiling);
			const prefix = `${label}/records/`;
			const originalRead = path => Promise.resolve(get(prefix + path));
			const handoff = await inspectNestedCheckedRecordWitHandoff(originalRead);
			const recordRead = path => handoff.supplements.get(path)
				?? originalRead(path);
			const reportOptions = {
				route, mode, producerCommit: nestedCheckedRecordWitProducer
				, runtime: nestedCheckedRecordWitRuntime, floor: "2.36"
			};
			const result = await checkNestedCheckedRecordWitReport(
				recordRead, reportOptions
			);
			assert.equal(run.archiveSha256, result.archiveSha256);
			assert.equal(run.reportSha256, result.reportSha256);
			assert.equal(run.executions, result.executions);
			assert.equal(run.records, result.records.length);
			assert.equal(handoff.archiveSha256, result.archiveSha256);
			const controlCounts = expectedControls(result.records.length, mode);
			assert.deepEqual(run.controls, controlCounts);
			const retainedControls = json(get(`${label}/controls.json`)
				, `${label}/controls.json`);
			assert.deepEqual(retainedControls, controlCounts);
			expectedPaths.push(`${label}/controls.json`);
			if(controls === "all" || controls === "representative" && position === 0)
			{
				const replay = await checkNestedCheckedRecordWitControls(
					recordRead, reportOptions
				);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key =>
					[key, replay[key]])), controlCounts);
			}
			expectedPaths.push(...result.records.filter(path =>
				!handoff.supplements.has(path)).concat(handoff.archivePath)
				.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit
			, checkerCommit: index.checkerCommit
			, selections: checked, files: index.files
			, selectedSources: index.selectedSources, controls
			, installedProfiles: ["wit-wasi"], supportPromoted: false
			, hostedAcceptance: false
		};
	})();
	if(read === readFile) cachedChecks.set(controls, checking);
	return checking;
};
