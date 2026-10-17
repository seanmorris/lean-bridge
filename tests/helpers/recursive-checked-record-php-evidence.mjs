/**
 * Authenticate the immutable hosted recursive checked-record native PHP archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordPhpControls } from "./recursive-checked-record-php-controls.mjs";
import { recursiveCheckedRecordPhpCounts } from "./recursive-checked-record-php-fixture.mjs";
import { checkRecursiveCheckedRecordPhpReport } from "./recursive-checked-record-php-report.mjs";
import {
	assertRecursiveCheckedRecordPhpEvidenceTap
	, assertRecursiveCheckedRecordPhpEvidenceTools
	, recursiveCheckedRecordPhpEvidence
	, recursiveCheckedRecordPhpEvidenceFloor
	, recursiveCheckedRecordPhpEvidenceLoadCeiling
	, recursiveCheckedRecordPhpEvidenceOriginal
	, recursiveCheckedRecordPhpEvidenceProducer
	, recursiveCheckedRecordPhpEvidenceRuntime
	, recursiveCheckedRecordPhpEvidenceSelections
	, recursiveCheckedRecordPhpEvidenceSources
	, recursiveCheckedRecordPhpEvidenceToolchainLogSha256
	, recursiveCheckedRecordPhpEvidenceToolsSha256
	, recursiveCheckedRecordPhpEvidenceVerifier
	, recursiveCheckedRecordPhpHostedArtifact
} from "./recursive-checked-record-php-provenance.mjs";

export { recursiveCheckedRecordPhpEvidence } from "./recursive-checked-record-php-provenance.mjs";
export const recursiveCheckedRecordPhpEvidenceSha256
	= "e8ff5de737d6ce22cbe601704813d2c4c5d35a63f8d13fec8542089469061f04";

const controlKeys = ["recordControls", "executionControls"
	, "toolControls", "resourceControls", "environmentControls"
	, "packageControls", "modelControls"];
const expectedControls = records => ({
	recordControls: records * 2, executionControls: 48, toolControls: 12
	, resourceControls: 7, environmentControls: 10
	, packageControls: 6, modelControls: 7
});
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_.+@$/[\]()-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const cachedChecks = new Map();

/**
 * Reconcile every hosted PHP package record, source, execution and negative control.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkRecursiveCheckedRecordPhpEvidence = async (read = readFile, { controls = "representative" } = {}) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cachedChecks.has(controls)) return cachedChecks.get(controls);
	const checking = (async () => {
		const bytes = Buffer.from(await read(recursiveCheckedRecordPhpEvidence + "/index.json"));
		assert.equal(sha256(bytes), recursiveCheckedRecordPhpEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), ["checkerCommit", "diskFloorBytes"
			, "files", "floor", "hostedArtifact", "kind", "limitations", "loadCeiling"
			, "producerCommit", "runs", "runtime", "schemaVersion", "selectedSources"
			, "toolchainLogSha256", "tools"]);
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "recursive-checked-record-php-installed-v1");
		assert.equal(index.producerCommit, recursiveCheckedRecordPhpEvidenceProducer);
		assert.equal(index.checkerCommit, recursiveCheckedRecordPhpEvidenceVerifier);
		assert.equal(index.loadCeiling, recursiveCheckedRecordPhpEvidenceLoadCeiling);
		assert.equal(index.diskFloorBytes, 2 * 1024 ** 3);
		assert.equal(index.floor, recursiveCheckedRecordPhpEvidenceFloor);
		assert.deepEqual(index.runtime, recursiveCheckedRecordPhpEvidenceRuntime);
		assert.deepEqual(index.hostedArtifact, recursiveCheckedRecordPhpHostedArtifact);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item.length));
		assertRecursiveCheckedRecordPhpEvidenceTools(index.tools);
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(recursiveCheckedRecordPhpEvidence + "/" + entry.path));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const expectedPaths = ["producer/tools.json", "producer/toolchain.log"];
		const toolBytes = get("producer/tools.json");
		assert.equal(sha256(toolBytes), recursiveCheckedRecordPhpEvidenceToolsSha256);
		assert.deepEqual(json(toolBytes, "producer/tools.json"), index.tools);
		const toolchainLog = get("producer/toolchain.log");
		assert.equal(sha256(toolchainLog), recursiveCheckedRecordPhpEvidenceToolchainLogSha256);
		assert.equal(index.toolchainLogSha256, sha256(toolchainLog));
		assert.match(toolchainLog.toString(), /Lean \(version 4\.32\.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release\)/u);
		const selectedSources = await recursiveCheckedRecordPhpEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const retained = `sources/${source.role}/${source.path}`; expectedPaths.push(retained);
			assert.deepEqual(get(retained)
				, recursiveCheckedRecordPhpEvidenceOriginal(source.revision, source.path)
				, `${source.role}:${source.path}`);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.fixture])
			, recursiveCheckedRecordPhpEvidenceSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, fixture] = recursiveCheckedRecordPhpEvidenceSelections[position];
			const label = `${route}-${fixture}`;
			assert.deepEqual(Object.keys(run).sort(), ["archiveSha256"
				, "artifacts", "controls", "counts", "dispatchObserved"
				, "executions", "fixture", "generatorPaths", "label"
				, "loadCeiling", "records", "reportSha256", "route"
				, "tapSha256", "verificationSha256"]);
			assert.equal(run.label, label);
			assert.equal(run.loadCeiling, recursiveCheckedRecordPhpEvidenceLoadCeiling);
			const tap = get(`${label}/run.tap`), verificationBytes = get(`${label}/verification.json`);
			expectedPaths.push(`${label}/run.tap`, `${label}/verification.json`, `${label}/controls.json`);
			assert.equal(run.tapSha256, sha256(tap));
			assert.equal(run.verificationSha256, sha256(verificationBytes));
			assertRecursiveCheckedRecordPhpEvidenceTap(tap.toString(), route, fixture);
			const prefix = `${label}/records/`;
			const recordRead = path => Promise.resolve(get(prefix + path));
			const reportOptions = {
				route, fixture, producerCommit: recursiveCheckedRecordPhpEvidenceProducer
				, runtime: recursiveCheckedRecordPhpEvidenceRuntime
				, floor: recursiveCheckedRecordPhpEvidenceFloor
				, phpVersion: index.tools.selected.phpVersion
				, composerVersion: index.tools.selected.composerVersion
			};
			const result = await checkRecursiveCheckedRecordPhpReport(recordRead, reportOptions);
			assert.deepEqual(result.counts, recursiveCheckedRecordPhpCounts[fixture]);
			assert.deepEqual(run.counts, result.counts);
			for(const key of ["archiveSha256", "reportSha256", "executions", "loadCeiling", "dispatchObserved"])
				assert.equal(run[key], result[key], key);
			assert.deepEqual(run.generatorPaths, result.generatorPaths);
			assert.equal(run.records, result.records.length);
			const report = json(await recordRead("report.json"), `${label}/records/report.json`);
			assert.deepEqual(run.artifacts, report.receipt.packages[0].artifacts);
			const controlCounts = expectedControls(result.records.length);
			assert.deepEqual(run.controls, controlCounts);
			assert.deepEqual(json(get(`${label}/controls.json`), `${label}/controls.json`), controlCounts);
			assert.equal(verificationBytes.toString(), canonicalJson({ ...result, tools: index.tools }));
			if(controls === "all" || controls === "representative" && position === 0)
			{
				const replay = await checkRecursiveCheckedRecordPhpControls(recordRead, reportOptions);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key => [key, replay[key]])), controlCounts);
			}
			expectedPaths.push(...result.records.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit
			, checkerCommit: index.checkerCommit
			, selections: checked, files: index.files
			, selectedSources: index.selectedSources
			, hostedArtifact: index.hostedArtifact, controls
			, installedProfiles: ["php-native"], supportPromoted: false
			, hostedAcceptance: true
		};
	})();
	if(read === readFile) cachedChecks.set(controls, checking);
	return checking;
};
