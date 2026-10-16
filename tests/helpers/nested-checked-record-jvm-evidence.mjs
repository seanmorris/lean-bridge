/**
 * Authenticate the immutable nested checked-record Java/Kotlin evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNestedCheckedRecordJvmControls } from "./nested-checked-record-jvm-controls.mjs";
import { checkNestedCheckedRecordJvmReport } from "./nested-checked-record-jvm-report.mjs";
import {
	assertNestedCheckedRecordJvmRun
	, nestedCheckedRecordJvmEvidence
	, nestedCheckedRecordJvmEvidenceSources
	, nestedCheckedRecordJvmLoadCeiling
	, nestedCheckedRecordJvmOriginal
	, nestedCheckedRecordJvmProducer
	, nestedCheckedRecordJvmRunnerNames
	, nestedCheckedRecordJvmSelections
	, nestedCheckedRecordJvmTools
} from "./nested-checked-record-jvm-provenance.mjs";

export { nestedCheckedRecordJvmEvidence } from "./nested-checked-record-jvm-provenance.mjs";
export const nestedCheckedRecordJvmEvidenceSha256 = "49f9f7b9803065e65b0ce10b0d0c63b3a2631dda56520bb80a3a55bddd42ed52";

const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+$/[\]-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2, executionControls: 48, probeControls: 22
	, packageControls: 4, modelControls: mode === "full" ? 5 : 4
	, resourceControls: 8
});
let cachedRepresentative;

/**
 * Reconcile every retained package member, source, execution, launch, and control count.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one representative matrix, all four, or none.
 */
export const checkNestedCheckedRecordJvmEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && controls === "representative" && cachedRepresentative)
		return cachedRepresentative;
	const checking = (async () => {
		const bytes = Buffer.from(await read(nestedCheckedRecordJvmEvidence + "/index.json"));
		assert.equal(sha256(bytes), nestedCheckedRecordJvmEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), ["completeSha256", "files", "kind"
			, "limitations", "loadCeiling", "producerCommit", "runners", "runs"
			, "schemaVersion", "selectedSources", "tools"].sort());
		assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nested-checked-record-jvm-installed-v1");
		assert.equal(index.producerCommit, nestedCheckedRecordJvmProducer);
		assert.equal(index.loadCeiling, nestedCheckedRecordJvmLoadCeiling);
		assert.deepEqual(index.tools, nestedCheckedRecordJvmTools);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 8
			&& index.limitations.every(item => typeof item === "string" && item.length > 0));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(nestedCheckedRecordJvmEvidence + "/" + entry.path));
			assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const expectedPaths = [], selectedSources = await nestedCheckedRecordJvmEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const path of selectedSources)
		{
			const retained = "sources/" + path; expectedPaths.push(retained);
			assert.deepEqual(get(retained), nestedCheckedRecordJvmOriginal(nestedCheckedRecordJvmProducer, path), path);
		}
		assert.deepEqual(index.runners.map(item => item.path), Object.values(nestedCheckedRecordJvmRunnerNames));
		for(const runner of index.runners)
		{
			assert.deepEqual(Object.keys(runner).sort(), ["path", "sha256"]);
			const path = "runners/" + runner.path, value = get(path); expectedPaths.push(path);
			assert.equal(sha256(value), runner.sha256);
		}
		const completeBytes = get("complete.json"), complete = json(completeBytes, "complete.json");
		expectedPaths.push("complete.json"); assert.equal(sha256(completeBytes), index.completeSha256);
		assert.deepEqual(complete, { finished: complete.finished
			, producer: nestedCheckedRecordJvmProducer
			, runtime: { arch: "x64", glibc: "2.36", platform: "linux" }
			, schemaVersion: 1, selections: nestedCheckedRecordJvmSelections
			, tools: nestedCheckedRecordJvmTools });
		assert.ok(Number.isFinite(Date.parse(complete.finished)));
		assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nestedCheckedRecordJvmSelections);
		const checked = []; let previousFinish = 0;
		for(const [position, run] of index.runs.entries())
		{
			const [route, mode] = nestedCheckedRecordJvmSelections[position], label = `${route}-${mode}`;
			assert.deepEqual(Object.keys(run).sort(), ["archiveSha256", "controls"
				, "controlsFinished"
				, "controlsSha256", "finished", "label", "originalFiles", "records"
				, "reportSha256", "route", "mode", "runner", "started", "stderrSha256"
				, "tapSha256", "verificationSha256"].sort());
			assert.equal(run.route, route); assert.equal(run.mode, mode);
			assert.equal(run.label, label);
			const expectedRunner = position < 2 ? nestedCheckedRecordJvmRunnerNames.initial
				: nestedCheckedRecordJvmRunnerNames.continuation;
			assert.equal(run.runner, expectedRunner);
			const base = `${label}/producer/`, startBytes = get(base + "start.json");
			const endBytes = get(base + "end.json"), tap = get(base + "run.tap");
			const stderr = get(base + "run.stderr"), verificationBytes = get(base + "verification.json");
			const controlsBytes = get(base + "controls.json");
			const start = json(startBytes, base + "start.json"), end = json(endBytes, base + "end.json");
			const verification = json(verificationBytes, base + "verification.json");
			const controlRecord = json(controlsBytes, base + "controls.json");
			assertNestedCheckedRecordJvmRun({ start, end, tap, stderr, route, mode, label });
			assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps the previous cell`);
			assert.equal(run.started, start.started); assert.equal(run.finished, end.finished);
			assert.equal(run.controlsFinished, controlRecord.finished);
			assert.equal(run.tapSha256, sha256(tap)); assert.equal(run.stderrSha256, sha256(stderr));
			assert.equal(run.verificationSha256, sha256(verificationBytes));
			assert.equal(run.controlsSha256, sha256(controlsBytes));
			assert.deepEqual(controlRecord.checked, verification);
			assert.equal(controlRecord.schemaVersion, 1); assert.equal(controlRecord.producer, nestedCheckedRecordJvmProducer);
			assert.equal(controlRecord.route, route); assert.equal(controlRecord.mode, mode);
			assert.equal(controlRecord.originalsUnchanged, true); assert.equal(controlRecord.originalFiles, run.originalFiles);
			assert.ok(Date.parse(end.finished) <= Date.parse(controlRecord.started));
			assert.ok(Date.parse(controlRecord.started) <= Date.parse(controlRecord.finished));
			const prefix = `${label}/records/`, recordRead = path => Promise.resolve(get(prefix + path));
			const result = await checkNestedCheckedRecordJvmReport(recordRead, {
				route, mode, producerCommit: nestedCheckedRecordJvmProducer
				, runtime: { platform: "linux", arch: "x64", glibc: "2.36" }
				, floor: "2.36", javaVersion: verification.javaVersion
			});
			assert.deepEqual(verification, { ...result, tools: verification.tools });
			assert.equal(run.archiveSha256, result.archiveSha256); assert.equal(run.reportSha256, result.reportSha256);
			assert.equal(run.records, result.records.length);
			const controlCounts = expectedControls(result.records.length, mode);
			assert.deepEqual(run.controls, controlCounts); assert.deepEqual(controlRecord.controls, controlCounts);
			if(controls === "all" || controls === "representative" && position === 0)
				assert.deepEqual(await checkNestedCheckedRecordJvmControls(recordRead, {
					route, mode, producerCommit: nestedCheckedRecordJvmProducer
					, runtime: result.runtime, floor: result.floor
					, javaVersion: result.javaVersion
				}), controlCounts);
			expectedPaths.push(...["start.json", "end.json", "run.tap", "run.stderr"
				, "verification.json", "controls.json"].map(path => base + path));
			expectedPaths.push(...result.records.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts, originalFiles: run.originalFiles
				, loadCeiling: nestedCheckedRecordJvmLoadCeiling });
			previousFinish = Date.parse(controlRecord.finished);
		}
		assert.ok(Date.parse(complete.finished) >= previousFinish);
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return { producerCommit: index.producerCommit, selections: checked
			, files: index.files, selectedSources: index.selectedSources, controls
			, installedProfiles: ["java", "kotlin"], supportPromoted: false
			, hostedAcceptance: false };
	})();
	if(read === readFile && controls === "representative") cachedRepresentative = checking;
	return checking;
};
