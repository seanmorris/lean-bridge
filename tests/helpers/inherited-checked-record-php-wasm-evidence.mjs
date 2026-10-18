/**
 * Authenticate the immutable hosted inherited checked-record PHP-Wasm archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkInheritedCheckedRecordPhpWasmCiRecords
} from "./inherited-checked-record-php-wasm-ci-report.mjs";
import {
	checkInheritedCheckedRecordPhpWasmControls
} from "./inherited-checked-record-php-wasm-controls.mjs";
import {
	checkInheritedCheckedRecordPhpWasmReport
} from "./inherited-checked-record-php-wasm-report.mjs";
import {
	assertInheritedCheckedRecordPhpWasmTap
} from "./inherited-checked-record-php-wasm-selections.mjs";
import {
	inheritedCheckedRecordPhpWasmEvidence
	, inheritedCheckedRecordPhpWasmLoadCeiling
	, inheritedCheckedRecordPhpWasmPinnedRevisions
	, inheritedCheckedRecordPhpWasmSelectedSources
	, inheritedCheckedRecordPhpWasmSelections
} from "./inherited-checked-record-php-wasm-provenance.mjs";
import {
	inheritedCheckedRecordPhpWasmOriginal
} from "./inherited-checked-record-php-wasm-sources.mjs";

export {
	inheritedCheckedRecordPhpWasmEvidence
} from "./inherited-checked-record-php-wasm-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const inheritedCheckedRecordPhpWasmEvidenceSha256
	= "7caa08e30ed7c05d20e065f882b7c87d998a1ed7e039e9b18b0f2a49b14accdd";

const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_.+@$/[\]-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path, canonical = true) => {
	const value = JSON.parse(bytes);
	if(canonical) assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2, semanticControls: mode === "full" ? 57 : 55
});
const cachedChecks = new Map();

/**
 * Reconcile every retained package, source, report, execution and control.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkInheritedCheckedRecordPhpWasmEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cachedChecks.has(controls))
		return cachedChecks.get(controls);
	const checking = (async () => {
		const revisions = inheritedCheckedRecordPhpWasmPinnedRevisions();
		assert.match(inheritedCheckedRecordPhpWasmEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the inherited PHP-Wasm archive index first");
		const indexBytes = Buffer.from(await read(
			`${inheritedCheckedRecordPhpWasmEvidence}/index.json`
		));
		assert.equal(sha256(indexBytes)
			, inheritedCheckedRecordPhpWasmEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "diskFloorBytes", "files", "host"
			, "hostedRun", "kind", "limitations", "loadCeiling"
			, "producerCommit", "runs", "runtimeIdentity"
			, "runtimeSnapshotSha256", "schemaVersion", "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "inherited-checked-record-php-wasm-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling, inheritedCheckedRecordPhpWasmLoadCeiling);
		assert.equal(index.diskFloorBytes, 2 * 1024 ** 3);
		assert.match(index.runtimeIdentity, /^[a-f0-9]{64}$/u);
		assert.match(index.runtimeSnapshotSha256, /^[a-f0-9]{64}$/u);
		assert.deepEqual(Object.keys(index.host).sort(), [
			"arch", "chromiumSha256", "composerSha256", "node", "nodeSha256"
			, "phpSha256", "platform", "schemaVersion"
		].sort());
		assert.equal(index.host.schemaVersion, 1);
		assert.equal(index.host.platform, "linux");
		assert.equal(index.host.arch, "x64");
		assert.match(index.host.node, /^v[0-9]+\.[0-9]+\.[0-9]+$/u);
		for(const key of [
			"chromiumSha256", "composerSha256", "nodeSha256", "phpSha256"
		]) assert.match(index.host[key], /^[a-f0-9]{64}$/u);
		assert.deepEqual(Object.keys(index.hostedRun).sort()
			, ["repository", "runId", "url"]);
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.ok(Number.isSafeInteger(index.hostedRun.runId)
			&& index.hostedRun.runId > 0);
		assert.equal(index.hostedRun.url
			, `https://github.com/seanmorris/lean-bridge/actions/runs/${index.hostedRun.runId}`);
		assert.ok(Array.isArray(index.limitations)
			&& index.limitations.length === 8
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0);
			previous = entry.path;
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				`${inheritedCheckedRecordPhpWasmEvidence}/${entry.path}`
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
		const expectedPaths = [];
		const selectedSources = inheritedCheckedRecordPhpWasmSelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const retained = `sources/${source.role}/${source.path}`;
			expectedPaths.push(retained);
			assert.deepEqual(get(retained), inheritedCheckedRecordPhpWasmOriginal(
				source.revision, source.path
			), `${source.role}:${source.path}`);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, inheritedCheckedRecordPhpWasmSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, mode] = inheritedCheckedRecordPhpWasmSelections[position];
			const label = `${route}-${mode}`, prefix = `${label}/records/`;
			assert.deepEqual(Object.keys(run).sort(), [
				"controls", "counts", "dispatchObserved", "executions", "label"
				, "loadCeiling", "mode", "packageFiles", "records"
				, "reportSha256", "route", "runtimeAfterLogSha256"
				, "runtimeBeforeLogSha256", "runtimeSnapshotSha256", "tapSha256"
				, "verificationSha256"
			].sort());
			assert.deepEqual([run.label, run.route, run.mode], [label, route, mode]);
			assert.equal(run.loadCeiling, inheritedCheckedRecordPhpWasmLoadCeiling);
			assert.equal(run.runtimeSnapshotSha256, index.runtimeSnapshotSha256);
			const recordRead = path => Promise.resolve(get(prefix + path));
			const result = await checkInheritedCheckedRecordPhpWasmReport(
				recordRead, { route, mode, producerCommit: revisions.producer }
			);
			assert.equal(run.records, result.records.length);
			for(const key of [
				"counts", "executions", "dispatchObserved", "packageFiles"
			]) assert.deepEqual(run[key], result[key], `${label} ${key}`);
			assert.equal(run.reportSha256, sha256(get(prefix + "report.json")));
			const tapPath = `${label}/run.tap`, tap = get(tapPath);
			assertInheritedCheckedRecordPhpWasmTap(tap.toString(), route, mode);
			assert.equal(run.tapSha256, sha256(tap));
			const beforePath = `${label}/runtime-before.json`;
			const afterPath = `${label}/runtime-after.json`;
			const beforeLogPath = `${label}/runtime-before.log`;
			const afterLogPath = `${label}/runtime-after.log`;
			const before = get(beforePath), after = get(afterPath);
			assert.deepEqual(after, before);
			assert.equal(sha256(before), index.runtimeSnapshotSha256);
			const runtime = json(before, beforePath, false);
			assert.equal(runtime.schemaVersion, 1);
			assert.equal(runtime.producerCommit, revisions.producer);
			assert.deepEqual(runtime.host, index.host);
			assert.equal(runtime.runtime.identity, index.runtimeIdentity);
			assert.equal(run.runtimeBeforeLogSha256, sha256(get(beforeLogPath)));
			assert.equal(run.runtimeAfterLogSha256, sha256(get(afterLogPath)));
			const ci = await checkInheritedCheckedRecordPhpWasmCiRecords({
				route, mode, producer: revisions.producer, directory: prefix
				, tap: tapPath, runtime: beforePath
			}, { tap: tap.toString(), runtime, paths: result.records, read: recordRead });
			assert.deepEqual(ci, result);
			const verificationPath = `${label}/verification.json`;
			const verification = get(verificationPath);
			assert.equal(verification.toString(), canonicalJson(result));
			assert.equal(run.verificationSha256, sha256(verification));
			const controlCounts = expectedControls(result.records.length, mode);
			assert.deepEqual(run.controls, controlCounts);
			const controlsPath = `${label}/controls.json`;
			assert.deepEqual(json(get(controlsPath), controlsPath), controlCounts);
			if(controls === "all"
				|| controls === "representative" && position === 0)
				assert.deepEqual(await checkInheritedCheckedRecordPhpWasmControls(
					new Map(result.records.map(path => [path, get(prefix + path)]))
					, { route, mode, producerCommit: revisions.producer }
				), controlCounts);
			expectedPaths.push(
				tapPath, beforePath, afterPath, beforeLogPath, afterLogPath
				, verificationPath, controlsPath
				, ...result.records.map(path => prefix + path)
			);
			checked.push({
				...result, ...controlCounts, loadCeiling: run.loadCeiling
			});
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, selections: checked, files: index.files
			, selectedSources: index.selectedSources, controls
			, installedProfiles: ["php-wasm"], hostedRun: index.hostedRun
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cachedChecks.set(controls, checking);
	return checking;
};
