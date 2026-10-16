/**
 * Authenticate the immutable nested checked-record native PHP archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNestedCheckedRecordPhpControls } from "./nested-checked-record-php-controls.mjs";
import { checkNestedCheckedRecordPhpReport } from "./nested-checked-record-php-report.mjs";
import {
	assertNestedCheckedRecordPhpEvidenceTap
	, nestedCheckedRecordPhpEvidence
	, nestedCheckedRecordPhpEvidenceSources
	, nestedCheckedRecordPhpLoadCeiling
	, nestedCheckedRecordPhpOriginal
	, nestedCheckedRecordPhpProducer
	, nestedCheckedRecordPhpRuntime
	, nestedCheckedRecordPhpSelections
	, nestedCheckedRecordPhpTools
	, nestedCheckedRecordPhpVerifier
} from "./nested-checked-record-php-provenance.mjs";

export { nestedCheckedRecordPhpEvidence } from "./nested-checked-record-php-provenance.mjs";
export const nestedCheckedRecordPhpEvidenceSha256
	= "434a4010a9e692055287e505e472f2a912313ae200dfa42aa39eefb405e6455b";

const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_.+$/[\]-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2, executionControls: 48, toolControls: 12
	, resourceControls: 7, environmentControls: 10, packageControls: 4
	, modelControls: mode === "full" ? 7 : 6
});
let cachedRepresentative;

/**
 * Reconcile every retained package, record, source, execution, and control.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkNestedCheckedRecordPhpEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && controls === "representative" && cachedRepresentative)
		return cachedRepresentative;
	const checking = (async () => {
		const bytes = Buffer.from(await read(nestedCheckedRecordPhpEvidence + "/index.json"));
		assert.equal(sha256(bytes), nestedCheckedRecordPhpEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"checkerCommit", "files", "kind", "limitations", "loadCeiling"
			, "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources", "tapSha256", "tools"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "nested-checked-record-php-installed-v1");
		assert.equal(index.producerCommit, nestedCheckedRecordPhpProducer);
		assert.equal(index.checkerCommit, nestedCheckedRecordPhpVerifier);
		assert.equal(index.loadCeiling, nestedCheckedRecordPhpLoadCeiling);
		assert.deepEqual(index.runtime, nestedCheckedRecordPhpRuntime);
		assert.deepEqual(index.tools, nestedCheckedRecordPhpTools);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item.length));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				nestedCheckedRecordPhpEvidence + "/" + entry.path
			));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const expectedPaths = [], selectedSources = await nestedCheckedRecordPhpEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const retained = `sources/${source.role}/${source.path}`;
			expectedPaths.push(retained);
			assert.deepEqual(get(retained), nestedCheckedRecordPhpOriginal(
				source.revision, source.path
			), `${source.role}:${source.path}`);
		}
		const tap = get("producer/run.tap"); expectedPaths.push("producer/run.tap");
		assert.equal(index.tapSha256, sha256(tap));
		assertNestedCheckedRecordPhpEvidenceTap(tap.toString());
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, nestedCheckedRecordPhpSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, mode] = nestedCheckedRecordPhpSelections[position];
			const label = `${route}-${mode}`;
			assert.deepEqual(Object.keys(run).sort(), [
				"archiveSha256", "controls", "executions", "label", "loadCeiling"
				, "mode", "records", "reportSha256", "route"
			].sort());
			assert.equal(run.label, label); assert.equal(run.route, route);
			assert.equal(run.mode, mode);
			assert.equal(run.loadCeiling, nestedCheckedRecordPhpLoadCeiling);
			const prefix = `${label}/records/`;
			const recordRead = path => Promise.resolve(get(prefix + path));
			const result = await checkNestedCheckedRecordPhpReport(recordRead, {
				route, mode, producerCommit: nestedCheckedRecordPhpProducer
				, runtime: nestedCheckedRecordPhpRuntime, floor: "2.36"
				, phpVersion: nestedCheckedRecordPhpTools.phpVersion
				, composerVersion: nestedCheckedRecordPhpTools.composerVersion
			});
			assert.equal(run.archiveSha256, result.archiveSha256);
			assert.equal(run.reportSha256, result.reportSha256);
			assert.equal(run.executions, result.executions);
			assert.equal(run.records, result.records.length);
			const controlCounts = expectedControls(result.records.length, mode);
			assert.deepEqual(run.controls, controlCounts);
			const retainedControls = json(get(`${label}/controls.json`)
				, `${label}/controls.json`);
			assert.deepEqual(retainedControls, controlCounts);
			expectedPaths.push(`${label}/controls.json`);
			if(controls === "all" || controls === "representative" && position === 0)
				assert.deepEqual(await checkNestedCheckedRecordPhpControls(recordRead, {
					route, mode, producerCommit: nestedCheckedRecordPhpProducer
					, runtime: nestedCheckedRecordPhpRuntime, floor: "2.36"
					, phpVersion: nestedCheckedRecordPhpTools.phpVersion
					, composerVersion: nestedCheckedRecordPhpTools.composerVersion
				}), controlCounts);
			expectedPaths.push(...result.records.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts
				, loadCeiling: nestedCheckedRecordPhpLoadCeiling });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit, checkerCommit: index.checkerCommit
			, selections: checked, files: index.files
			, selectedSources: index.selectedSources, controls
			, installedProfiles: ["php-native"], supportPromoted: false
			, hostedAcceptance: false
		};
	})();
	if(read === readFile && controls === "representative")
		cachedRepresentative = checking;
	return checking;
};
