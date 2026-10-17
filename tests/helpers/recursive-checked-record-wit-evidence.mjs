/**
 * Authenticate the immutable recursive checked-record WIT/WASI evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordWitControls } from "./recursive-checked-record-wit-controls.mjs";
import { recursiveCheckedRecordWitCounts } from "./recursive-checked-record-wit-fixture.mjs";
import { inspectRecursiveCheckedRecordWitHandoff } from "./recursive-checked-record-wit-handoff.mjs";
import { checkRecursiveCheckedRecordWitReport } from "./recursive-checked-record-wit-report.mjs";
import {
	assertRecursiveCheckedRecordWitEvidenceTap, assertRecursiveCheckedRecordWitRefusalTap
	, recursiveCheckedRecordWitAttempts, recursiveCheckedRecordWitEvidence
	, recursiveCheckedRecordWitEvidenceSources, recursiveCheckedRecordWitLoadCeiling
	, recursiveCheckedRecordWitOriginal, recursiveCheckedRecordWitProducer
	, recursiveCheckedRecordWitRefusals, recursiveCheckedRecordWitRuntime
	, recursiveCheckedRecordWitSelections, recursiveCheckedRecordWitTools
	, recursiveCheckedRecordWitVerifier
} from "./recursive-checked-record-wit-provenance.mjs";

export { recursiveCheckedRecordWitEvidence } from "./recursive-checked-record-wit-provenance.mjs";
export const recursiveCheckedRecordWitEvidenceSha256
	= "aa176d8438f740c236382c3694332203ebb0a97db481cec18eed3863baef0349";

const controlKeys = ["recordControls", "reportControls"
	, "executionControls", "toolControls"
	, "resourceControls", "environmentControls"
	, "packageControls", "transportControls", "modelControls"];
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_.+$/[\]-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
// Fixed per-selection control counts; only the record controls scale with the retained records.
const expectedControls = records => ({
	recordControls: records * 2 + 4, reportControls: 16
	, executionControls: 29, toolControls: 12, resourceControls: 8
	, environmentControls: 16, packageControls: 7
	, transportControls: 5, modelControls: 10
});
const cachedChecks = new Map();

/**
 * Reconcile every retained component archive, record, source, execution, refusal and control.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkRecursiveCheckedRecordWitEvidence = async (read = readFile, { controls = "representative" } = {}) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cachedChecks.has(controls)) return cachedChecks.get(controls);
	const checking = (async () => {
		const bytes = Buffer.from(await read(recursiveCheckedRecordWitEvidence + "/index.json"));
		assert.equal(sha256(bytes), recursiveCheckedRecordWitEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), ["checkerCommit", "files"
			, "kind", "limitations", "loadCeiling", "producerCommit"
			, "refusals", "runners", "runs", "runtime", "schemaVersion"
			, "selectedSources", "tools"]);
		assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "recursive-checked-record-wit-installed-v1");
		assert.equal(index.producerCommit, recursiveCheckedRecordWitProducer);
		assert.equal(index.checkerCommit, recursiveCheckedRecordWitVerifier);
		assert.equal(index.loadCeiling, recursiveCheckedRecordWitLoadCeiling);
		assert.deepEqual(index.runtime, recursiveCheckedRecordWitRuntime);
		assert.deepEqual(index.tools, recursiveCheckedRecordWitTools);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item.length));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(recursiveCheckedRecordWitEvidence + "/" + entry.path));
			assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const expectedPaths = [];
		const selectedSources = recursiveCheckedRecordWitEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const source of selectedSources)
		{
			const retained = `sources/${source.role}/${source.path}`; expectedPaths.push(retained);
			assert.deepEqual(get(retained), recursiveCheckedRecordWitOriginal(source.revision, source.path), `${source.role}:${source.path}`);
		}
		assert.deepEqual(Object.keys(index.runners), ["r1", "r2", "r3"]);
		for(const [attempt, exit] of [["r1", 4], ["r2", 4], ["r3", 0]])
		{
			const script = get(`producer/runners/${attempt}.sh`), log = get(`producer/runners/${attempt}.log`);
			expectedPaths.push(`producer/runners/${attempt}.sh`, `producer/runners/${attempt}.log`);
			assert.deepEqual(index.runners[attempt], { scriptSha256: sha256(script), logSha256: sha256(log), exit });
			assert.ok(script.includes(`test "$(git rev-parse HEAD)" = ${recursiveCheckedRecordWitProducer} ||`), attempt);
			assert.ok(log.toString().endsWith(`exit ${exit}\n`), attempt);
		}
		assert.deepEqual(index.refusals.map(({ attempt, label, error }) => ({ attempt, label, error }))
			, recursiveCheckedRecordWitRefusals.map(item => ({ ...item })));
		for(const refusal of index.refusals)
		{
			const prefix = `refusals/${refusal.attempt}-${refusal.label}`;
			const tap = get(`${prefix}/run.tap`), resources = get(`${prefix}/resources.json`);
			expectedPaths.push(`${prefix}/run.tap`, `${prefix}/resources.json`);
			assertRecursiveCheckedRecordWitRefusalTap(tap.toString(), refusal);
			assert.deepEqual(Object.keys(refusal).sort(), ["attempt", "error", "label", "resourcesSha256", "tapSha256"]);
			assert.equal(refusal.tapSha256, sha256(tap)); assert.equal(refusal.resourcesSha256, sha256(resources));
			json(resources, `${prefix}/resources.json`);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.fixture]), recursiveCheckedRecordWitSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, fixture] = recursiveCheckedRecordWitSelections[position], label = `${route}-${fixture}`;
			assert.deepEqual(Object.keys(run).sort(), ["archiveSha256", "attempt"
				, "controls", "counts", "executions", "fixture", "label"
				, "loadCeiling", "records", "reportSha256", "route"
				, "tapSha256", "verificationSha256"]);
			assert.equal(run.label, label); assert.equal(run.attempt, recursiveCheckedRecordWitAttempts[label]);
			assert.equal(run.loadCeiling, recursiveCheckedRecordWitLoadCeiling);
			const tap = get(`${label}/run.tap`), verificationBytes = get(`${label}/verification.json`);
			expectedPaths.push(`${label}/run.tap`, `${label}/verification.json`, `${label}/controls.json`);
			assert.equal(run.tapSha256, sha256(tap)); assert.equal(run.verificationSha256, sha256(verificationBytes));
			assertRecursiveCheckedRecordWitEvidenceTap(tap.toString(), route, fixture);
			const prefix = `${label}/records/`, originalRead = path => Promise.resolve(get(prefix + path));
			const handoff = await inspectRecursiveCheckedRecordWitHandoff(originalRead, fixture);
			const recordRead = path => handoff.supplements.get(path) ?? originalRead(path);
			const reportOptions = { route, fixture
				, producerCommit: recursiveCheckedRecordWitProducer
				, runtime: recursiveCheckedRecordWitRuntime, floor: "2.36" };
			const result = await checkRecursiveCheckedRecordWitReport(recordRead, reportOptions);
			assert.deepEqual(result.counts, recursiveCheckedRecordWitCounts[fixture]); assert.deepEqual(run.counts, result.counts);
			for(const key of ["archiveSha256", "reportSha256", "executions", "loadCeiling"]) assert.equal(run[key], result[key], key);
			assert.equal(run.records, result.records.length); assert.equal(handoff.archiveSha256, result.archiveSha256);
			const controlCounts = expectedControls(result.records.length);
			assert.deepEqual(run.controls, controlCounts);
			assert.deepEqual(json(get(`${label}/controls.json`), `${label}/controls.json`), controlCounts);
			// The original checker output is exactly the report, its selected tools and every control.
			const tools = json(await originalRead("tools.json"), "tools.json");
			assert.equal(verificationBytes.toString(), canonicalJson({ ...result, tools, controls: controlCounts }));
			if(controls === "all" || controls === "representative" && position === 0)
			{
				const replay = await checkRecursiveCheckedRecordWitControls(recordRead, reportOptions);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key => [key, replay[key]])), controlCounts);
			}
			expectedPaths.push(...result.records.filter(path => !handoff.supplements.has(path))
				.concat(handoff.archivePath).map(path => prefix + path));
			checked.push({ ...result, ...controlCounts, attempt: run.attempt });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return { producerCommit: index.producerCommit
			, checkerCommit: index.checkerCommit
			, selections: checked, refusals: index.refusals, files: index.files
			, selectedSources: index.selectedSources, controls
			, installedProfiles: ["wit-wasi"], supportPromoted: false
			, hostedAcceptance: false };
	})();
	if(read === readFile) cachedChecks.set(controls, checking);
	return checking;
};
