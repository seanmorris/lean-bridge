/**
 * Authenticate the complete local primitive-base nominal .NET evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeDotnetControls } from "./nominal-primitive-subtype-dotnet-controls.mjs";
import { checkNominalPrimitiveSubtypeDotnetReport, nominalPrimitiveSubtypeDotnetRecords } from "./nominal-primitive-subtype-dotnet-report.mjs";
import {
	assertNominalPrimitiveSubtypeDotnetRun
	, nominalPrimitiveSubtypeDotnetAcceptedLaunches
	, nominalPrimitiveSubtypeDotnetEvidence
	, nominalPrimitiveSubtypeDotnetEvidenceSources
	, nominalPrimitiveSubtypeDotnetLaunchPaths
	, nominalPrimitiveSubtypeDotnetLoadCeiling
	, nominalPrimitiveSubtypeDotnetOriginal
	, nominalPrimitiveSubtypeDotnetProducer
	, nominalPrimitiveSubtypeDotnetSelections
} from "./nominal-primitive-subtype-dotnet-provenance.mjs";

export { nominalPrimitiveSubtypeDotnetEvidence } from "./nominal-primitive-subtype-dotnet-provenance.mjs";
export const nominalPrimitiveSubtypeDotnetEvidenceSha256 = "73409fead52b529e8a9a43981df79d93063b0a7993482add796d5fa697814e78";

const floor = "2.36";
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+/[\]-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const duration = tap => {
	const matches = [...tap.toString().matchAll(/^# duration_ms ([0-9]+(?:\.[0-9]+)?)$/gmu)];
	assert.equal(matches.length, 1); return Number(matches[0][1]);
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2
	, environmentControls: 28
	, packageControls: 5
	, modelControls: mode === "full" ? 5 : 4
	, executionControls: 30
});
const handoff = Object.freeze([
	"handoff/package-set-receipt.json"
	, "handoff/package-set-receipt.json.sha256"
	, "handoff/archives/Nominalprimitivesubtypes.Api.1.0.0.nupkg"
]);
let cachedRepresentative;

/**
 * Reconcile every retained package, source, report, launch, and control count.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one representative matrix, all four, or none.
 */
export const checkNominalPrimitiveSubtypeDotnetEvidence = async (
	read = readFile
	, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && controls === "representative" && cachedRepresentative)
		return cachedRepresentative;
	const checking = (async () => {
		const bytes = await read(nominalPrimitiveSubtypeDotnetEvidence + "/index.json");
		assert.equal(sha256(bytes), nominalPrimitiveSubtypeDotnetEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"files", "kind", "limitations", "loadCeiling", "producerCommit"
			, "runs", "schemaVersion", "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "nominal-primitive-subtype-dotnet-installed-v1");
		assert.equal(index.producerCommit, nominalPrimitiveSubtypeDotnetProducer);
		assert.equal(index.loadCeiling, nominalPrimitiveSubtypeDotnetLoadCeiling);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item.length > 0));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(nominalPrimitiveSubtypeDotnetEvidence + "/" + entry.path));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path); files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const selectedSources = await nominalPrimitiveSubtypeDotnetEvidenceSources();
		const expectedPaths = [];
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const path of selectedSources)
		{
			const retained = "sources/" + path; expectedPaths.push(retained);
			assert.deepEqual(get(retained), nominalPrimitiveSubtypeDotnetOriginal(
				nominalPrimitiveSubtypeDotnetProducer, path
			), path);
		}
		const runner = get("sources/scripts/run-nominal-primitive-subtype-dotnet-local.mjs");
		assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeDotnetSelections);
		const checked = []; let previousFinish = 0;
		for(const [position, run] of index.runs.entries())
		{
			const launch = nominalPrimitiveSubtypeDotnetAcceptedLaunches[position];
			const { route, mode, attempt } = launch, label = `${route}-${mode}`;
			const origin = nominalPrimitiveSubtypeDotnetLaunchPaths(launch);
			for(const key of ["route", "mode", "attempt"]) assert.equal(run[key], launch[key], `${label} ${key}`);
			assert.equal(run.label, label); assert.deepEqual(run.origin, origin);
			assert.equal(run.producerCommit, nominalPrimitiveSubtypeDotnetProducer);
			assert.equal(run.loadCeiling, nominalPrimitiveSubtypeDotnetLoadCeiling);
			assert.equal(run.floor, floor);
			const base = `${label}/producer/`, startBytes = get(base + "start.json");
			const endBytes = get(base + "end.json"), tap = get(base + "run.tap");
			const verificationBytes = get(base + "verification.json");
			const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
			const verification = json(verificationBytes, base + "verification.json");
			assertNominalPrimitiveSubtypeDotnetRun({
				start, end, tap, runner, route, mode, prefix: origin.prefix
				, producerCommit: nominalPrimitiveSubtypeDotnetProducer
				, floor, loadCeiling: nominalPrimitiveSubtypeDotnetLoadCeiling
			});
			assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps the previous selection`);
			assert.equal(run.started, start.started); assert.equal(run.finished, end.finished);
			assert.equal(run.durationMs, duration(tap)); assert.equal(run.startSha256, sha256(startBytes));
			assert.equal(run.endSha256, sha256(endBytes)); assert.equal(run.tapSha256, sha256(tap));
			assert.equal(run.verificationSha256, sha256(verificationBytes));
			const prefix = `${label}/records/`, recordRead = path => Promise.resolve(get(prefix + path));
			const nuget = json(get(prefix + "nuget.json"), prefix + "nuget.json");
			const context = json(get(prefix + "installation.json"), prefix + "installation.json");
			const records = nominalPrimitiveSubtypeDotnetRecords(route, mode, nuget, context);
			const result = await checkNominalPrimitiveSubtypeDotnetReport(recordRead, {
				route, mode, producerCommit: nominalPrimitiveSubtypeDotnetProducer
				, runtime: run.runtime, floor, toolchain: run.toolchain
				, framework: run.framework, archiveSha512: run.archiveSha512
			});
			assert.deepEqual(verification, { archiveSha256: run.archiveSha256, ...result });
			assert.equal(run.reportSha256, sha256(get(prefix + "report.json")));
			for(const key of ["runtime", "toolchain", "framework", "archiveSha512"
				, "counts", "executions", "dispatchObserved"
				, "generatorModules", "records"])
				assert.deepEqual(run[key], result[key], `${label} ${key}`);
			const controlCounts = expectedControls(records.length, mode);
			assert.deepEqual(run.controls, controlCounts);
			if(controls === "all" || controls === "representative" && position === 0)
			{
				const controlled = await checkNominalPrimitiveSubtypeDotnetControls(recordRead, {
					route, mode, producerCommit: nominalPrimitiveSubtypeDotnetProducer
					, runtime: run.runtime, floor, toolchain: run.toolchain
					, framework: run.framework, archiveSha512: run.archiveSha512
				});
				assert.deepEqual(controlled, { ...result, ...controlCounts });
			}
			expectedPaths.push(...["start.json", "end.json", "run.tap", "verification.json"]
				.map(path => base + path));
			expectedPaths.push(...[...records, ...handoff].map(path => prefix + path));
			checked.push({ ...result, ...controlCounts, attempt
				, loadCeiling: nominalPrimitiveSubtypeDotnetLoadCeiling });
			previousFinish = Date.parse(end.finished);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit, selections: checked
			, files: index.files, selectedSources: index.selectedSources, controls
			, installedProfiles: ["dotnet"], supportPromoted: false
			, hostedAcceptance: false
		};
	})();
	if(read === readFile && controls === "representative") cachedRepresentative = checking;
	return checking;
};
