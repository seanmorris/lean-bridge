/**
 * Authenticate the immutable nested checked-record PHP-Wasm archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNestedCheckedRecordPhpWasmCiRecords } from "./nested-checked-record-php-wasm-ci-report.mjs";
import { checkNestedCheckedRecordPhpWasmControls } from "./nested-checked-record-php-wasm-controls.mjs";
import { checkNestedCheckedRecordPhpWasmReport } from "./nested-checked-record-php-wasm-report.mjs";
import {
	assertNestedCheckedRecordPhpWasmTap
	, nestedCheckedRecordPhpWasmEvidence
	, nestedCheckedRecordPhpWasmEvidenceSources
	, nestedCheckedRecordPhpWasmLoadCeiling
	, nestedCheckedRecordPhpWasmOriginal
	, nestedCheckedRecordPhpWasmProducer
	, nestedCheckedRecordPhpWasmSelections
	, nestedCheckedRecordPhpWasmVerifier
} from "./nested-checked-record-php-wasm-provenance.mjs";

export { nestedCheckedRecordPhpWasmEvidence } from "./nested-checked-record-php-wasm-provenance.mjs";
export const nestedCheckedRecordPhpWasmEvidenceSha256
	= "2b15fdb79758837b7d32f11957f615e8243d2bc8e38e0105c3abdc97657dbfc8";

const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_.+@$/[\]-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path, canonical = true) => {
	const value = JSON.parse(bytes);
	if(canonical) assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2, semanticControls: mode === "full" ? 58 : 56
});
const cachedChecks = new Map();

/**
 * Reconcile every retained package, source, report, execution and control.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkNestedCheckedRecordPhpWasmEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cachedChecks.has(controls)) return cachedChecks.get(controls);
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(
			nestedCheckedRecordPhpWasmEvidence + "/index.json"
		));
		assert.equal(sha256(indexBytes), nestedCheckedRecordPhpWasmEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"checkerCommit", "diskFloorBytes", "files", "host", "kind"
			, "limitations", "loadCeiling", "producerCommit", "runs"
			, "runtimeIdentity", "runtimeSnapshotSha256", "schemaVersion"
			, "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "nested-checked-record-php-wasm-installed-v1");
		assert.equal(index.producerCommit, nestedCheckedRecordPhpWasmProducer);
		assert.equal(index.checkerCommit, nestedCheckedRecordPhpWasmVerifier);
		assert.equal(index.loadCeiling, nestedCheckedRecordPhpWasmLoadCeiling);
		assert.equal(index.diskFloorBytes, 2 * 1024 ** 3);
		assert.match(index.runtimeIdentity, /^[a-f0-9]{64}$/u);
		assert.match(index.runtimeSnapshotSha256, /^[a-f0-9]{64}$/u);
		assert.deepEqual(Object.keys(index.host).sort(), [
			"arch", "chromiumSha256", "composerSha256", "node", "nodeSha256"
			, "phpSha256", "platform", "schemaVersion"
		].sort());
		assert.equal(index.host.schemaVersion, 1);
		assert.equal(index.host.platform, "linux"); assert.equal(index.host.arch, "x64");
		assert.match(index.host.node, /^v[0-9]+\.[0-9]+\.[0-9]+$/u);
		for(const key of ["chromiumSha256", "composerSha256", "nodeSha256", "phpSha256"])
			assert.match(index.host[key], /^[a-f0-9]{64}$/u);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 9
			&& index.limitations.every(item => typeof item === "string" && item.length));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				nestedCheckedRecordPhpWasmEvidence + "/" + entry.path
			));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const expectedPaths = [];
		const selectedSources = nestedCheckedRecordPhpWasmEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const retained = `sources/${source.role}/${source.path}`;
			expectedPaths.push(retained);
			assert.deepEqual(get(retained), nestedCheckedRecordPhpWasmOriginal(
				source.revision, source.path
			), `${source.role}:${source.path}`);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, nestedCheckedRecordPhpWasmSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, mode] = nestedCheckedRecordPhpWasmSelections[position];
			const label = `${route}-${mode}`, prefix = `${label}/records/`;
			assert.deepEqual(Object.keys(run).sort(), [
				"controls", "counts", "dispatchObserved", "executions", "label"
				, "loadCeiling", "mode", "packageFiles", "records"
				, "reportSha256", "route", "runtimeSnapshotSha256", "tapSha256"
			].sort());
			assert.deepEqual([run.label, run.route, run.mode], [label, route, mode]);
			assert.equal(run.loadCeiling, nestedCheckedRecordPhpWasmLoadCeiling);
			assert.equal(run.runtimeSnapshotSha256, index.runtimeSnapshotSha256);
			const recordRead = path => Promise.resolve(get(prefix + path));
			const result = await checkNestedCheckedRecordPhpWasmReport(recordRead, {
				route, mode, producerCommit: nestedCheckedRecordPhpWasmProducer
			});
			assert.equal(run.records, result.records.length);
			for(const key of ["counts", "executions", "dispatchObserved", "packageFiles"])
				assert.deepEqual(run[key], result[key], `${label} ${key}`);
			assert.equal(run.reportSha256, sha256(get(prefix + "report.json")));
			const tapPath = `${label}/run.tap`, tap = get(tapPath);
			assertNestedCheckedRecordPhpWasmTap(tap.toString(), route, mode);
			assert.equal(run.tapSha256, sha256(tap)); expectedPaths.push(tapPath);
			const beforePath = `${label}/runtime-before.json`;
			const afterPath = `${label}/runtime-after.json`;
			const before = get(beforePath), after = get(afterPath);
			assert.deepEqual(after, before);
			assert.equal(sha256(before), index.runtimeSnapshotSha256);
			const runtime = json(before, beforePath, false);
			assert.equal(runtime.schemaVersion, 1);
			assert.equal(runtime.producerCommit, nestedCheckedRecordPhpWasmProducer);
			assert.deepEqual(runtime.host, index.host);
			assert.equal(runtime.runtime.identity, index.runtimeIdentity);
			const ci = await checkNestedCheckedRecordPhpWasmCiRecords({
				route, mode, producer: nestedCheckedRecordPhpWasmProducer
				, directory: prefix, tap: tapPath, runtime: beforePath
			}, { tap: tap.toString(), runtime, paths: result.records, read: recordRead });
			assert.deepEqual(ci, result);
			expectedPaths.push(beforePath, afterPath);
			const controlCounts = expectedControls(result.records.length, mode);
			assert.deepEqual(run.controls, controlCounts);
			const controlsPath = `${label}/controls.json`;
			assert.deepEqual(json(get(controlsPath), controlsPath), controlCounts);
			expectedPaths.push(controlsPath);
			if(controls === "all" || controls === "representative" && position === 0)
				assert.deepEqual(await checkNestedCheckedRecordPhpWasmControls(
					new Map(result.records.map(path => [path, get(prefix + path)]))
					, { route, mode, producerCommit: nestedCheckedRecordPhpWasmProducer }
				), controlCounts);
			expectedPaths.push(...result.records.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts
				, loadCeiling: run.loadCeiling });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit, checkerCommit: index.checkerCommit
			, selections: checked, files: index.files
			, selectedSources: index.selectedSources, controls
			, installedProfiles: ["php-wasm"], supportPromoted: false
			, hostedAcceptance: false
		};
	})();
	if(read === readFile) cachedChecks.set(controls, checking);
	return checking;
};
