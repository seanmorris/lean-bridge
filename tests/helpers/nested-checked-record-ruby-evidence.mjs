/**
 * Authenticate the immutable nested checked-record Ruby archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNestedCheckedRecordRubyControls } from "./nested-checked-record-ruby-controls.mjs";
import { checkNestedCheckedRecordRubyReport } from "./nested-checked-record-ruby-report.mjs";
import {
	assertNestedCheckedRecordRubyEvidenceTap
	, nestedCheckedRecordRubyEvidence
	, nestedCheckedRecordRubyEvidenceSources
	, nestedCheckedRecordRubyInterpreter
	, nestedCheckedRecordRubyLoadCeiling
	, nestedCheckedRecordRubyOriginal
	, nestedCheckedRecordRubyProducer
	, nestedCheckedRecordRubyRuntime
	, nestedCheckedRecordRubySelections
	, nestedCheckedRecordRubyVerifier
} from "./nested-checked-record-ruby-provenance.mjs";

export { nestedCheckedRecordRubyEvidence } from "./nested-checked-record-ruby-provenance.mjs";
export const nestedCheckedRecordRubyEvidenceSha256
	= "9a520f43076bdaca2fd38c8bfce320b6584dc022d8b3e2f06e5ef56f3213660e";

const controlKeys = ["recordControls", "resourceControls"
	, "environmentControls", "packageControls", "modelControls"
	, "executionControls"];
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_.+$/[\]-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 7
	, environmentControls: 12, packageControls: 4
	, modelControls: mode === "full" ? 6 : 5, executionControls: 20
});
const cachedChecks = new Map();

/**
 * Reconcile every retained gem, record, source, execution, and control.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkNestedCheckedRecordRubyEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cachedChecks.has(controls))
		return cachedChecks.get(controls);
	const checking = (async () => {
		const bytes = Buffer.from(await read(
			nestedCheckedRecordRubyEvidence + "/index.json"
		));
		assert.equal(sha256(bytes), nestedCheckedRecordRubyEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"checkerCommit", "files", "interpreter", "kind", "limitations"
			, "loadCeiling", "producerCommit", "runs", "runtime"
			, "schemaVersion", "selectedSources", "tapSha256"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "nested-checked-record-ruby-installed-v1");
		assert.equal(index.producerCommit, nestedCheckedRecordRubyProducer);
		assert.equal(index.checkerCommit, nestedCheckedRecordRubyVerifier);
		assert.equal(index.loadCeiling, nestedCheckedRecordRubyLoadCeiling);
		assert.deepEqual(index.runtime, nestedCheckedRecordRubyRuntime);
		assert.deepEqual(index.interpreter, nestedCheckedRecordRubyInterpreter);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item =>
				typeof item === "string" && item.length));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				nestedCheckedRecordRubyEvidence + "/" + entry.path
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
		const selectedSources = await nestedCheckedRecordRubyEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const retained = `sources/${source.role}/${source.path}`;
			expectedPaths.push(retained);
			assert.deepEqual(get(retained), nestedCheckedRecordRubyOriginal(
				source.revision, source.path
			), `${source.role}:${source.path}`);
		}
		const tap = get("producer/run.tap");
		expectedPaths.push("producer/run.tap");
		assert.equal(index.tapSha256, sha256(tap));
		assertNestedCheckedRecordRubyEvidenceTap(tap.toString());
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, nestedCheckedRecordRubySelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, mode] = nestedCheckedRecordRubySelections[position];
			const label = `${route}-${mode}`;
			assert.deepEqual(Object.keys(run).sort(), [
				"archiveSha256", "controls", "executions", "label"
				, "loadCeiling", "mode", "records", "reportSha256", "route"
			].sort());
			assert.equal(run.label, label); assert.equal(run.route, route);
			assert.equal(run.mode, mode);
			assert.equal(run.loadCeiling, nestedCheckedRecordRubyLoadCeiling);
			const prefix = `${label}/records/`;
			const recordRead = path => Promise.resolve(get(prefix + path));
			const result = await checkNestedCheckedRecordRubyReport(recordRead, {
				route, mode, producerCommit: nestedCheckedRecordRubyProducer
				, runtime: nestedCheckedRecordRubyRuntime, floor: "2.36"
				, rubyVersion: nestedCheckedRecordRubyInterpreter.version
			});
			assert.equal(run.archiveSha256, result.archiveSha256);
			assert.equal(run.reportSha256, result.reportSha256);
			assert.equal(run.executions, result.executions);
			assert.equal(run.records, result.records);
			const controlCounts = expectedControls(result.records, mode);
			assert.deepEqual(run.controls, controlCounts);
			const retainedControls = json(get(`${label}/controls.json`)
				, `${label}/controls.json`);
			assert.deepEqual(retainedControls, controlCounts);
			expectedPaths.push(`${label}/controls.json`);
			if(controls === "all" || controls === "representative" && position === 0)
			{
				const replay = await checkNestedCheckedRecordRubyControls(
					recordRead, {
						route, mode
						, producerCommit: nestedCheckedRecordRubyProducer
						, runtime: nestedCheckedRecordRubyRuntime, floor: "2.36"
						, rubyVersion: nestedCheckedRecordRubyInterpreter.version
					}
				);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key =>
					[key, replay[key]])), controlCounts);
			}
			expectedPaths.push(...result.recordPaths.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit
			, checkerCommit: index.checkerCommit
			, selections: checked, files: index.files
			, selectedSources: index.selectedSources, controls
			, installedProfiles: ["ruby"], supportPromoted: false
			, hostedAcceptance: false
		};
	})();
	if(read === readFile) cachedChecks.set(controls, checking);
	return checking;
};
