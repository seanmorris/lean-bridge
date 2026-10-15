/**
 * Authenticate the complete local nineteen-base nominal WIT evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeWitControls } from "./nominal-primitive-subtype-wit-controls.mjs";
import { checkNominalPrimitiveSubtypeWitReport } from "./nominal-primitive-subtype-wit-report.mjs";
import { nominalSubtypeWitGenerator, nominalSubtypeWitOriginal } from "./nominal-subtype-wit-generators.mjs";
import {
	assertNominalPrimitiveSubtypeWitControlsRun
	, assertNominalPrimitiveSubtypeWitPreservedLaunch
	, assertNominalPrimitiveSubtypeWitRun
	, nominalPrimitiveSubtypeWitAcceptedLaunches
	, nominalPrimitiveSubtypeWitControlSources
	, nominalPrimitiveSubtypeWitControlsRunner
	, nominalPrimitiveSubtypeWitFirstControlsRunner
	, nominalPrimitiveSubtypeWitFirstRunner
	, nominalPrimitiveSubtypeWitFirstWorktree
	, nominalPrimitiveSubtypeWitLoadCeiling
	, nominalPrimitiveSubtypeWitPreservedLaunches
	, nominalPrimitiveSubtypeWitProducer
	, nominalPrimitiveSubtypeWitRunner
	, nominalPrimitiveSubtypeWitSelections
	, nominalPrimitiveSubtypeWitTools
	, nominalPrimitiveSubtypeWitWorktree
} from "./nominal-primitive-subtype-wit-provenance.mjs";

export const nominalPrimitiveSubtypeWitEvidence = "docs/evidence/nominal-primitive-subtype-wit-20261015";
export const nominalPrimitiveSubtypeWitEvidenceSha256 = "73dbdab6068a4a2a5b37819719d8bee9e461073f699120a164eb4d7a7e45c2f5";
export const nominalPrimitiveSubtypeWitEvidenceSources = Object.freeze([
	"src/analyze/NativeExports.lean"
	, "src/build/native-component.mjs"
	, "src/build/native-wit-artifacts.mjs"
	, "src/release/native-wasi.mjs"
	, "src/release/deterministic-archive.mjs"
	, "src/release/package-set-receipt.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/module-closure.mjs"
	, "tests/helpers/nominal-primitive-subtype-fixture.mjs"
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-archives.mjs"
	, "tests/helpers/package-set.mjs"
	, "tests/helpers/type-corpus-reviewed-ir.mjs"
	, ...nominalPrimitiveSubtypeWitControlSources
	, ...["LICENSE", "NominalPrimitiveSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/nominal-primitive-subtypes/${path}`)
]);
export const nominalPrimitiveSubtypeWitEvidenceCheckers = Object.freeze([
	"ci-report", "controls", "environment-records", "handoff", "model-records"
	, "package", "package-records", "provenance", "report"
	, "generators", "interface", "tool-records", "tools"
]);
/**
 * Shared Nat-era checkers live under the nominal-subtype-wit prefix.
 *
 * @param name - Checker name from the evidence index.
 */
export const nominalPrimitiveSubtypeWitCheckerPath = name => ["generators", "interface", "tool-records", "tools"].includes(name)
	? `tests/helpers/nominal-subtype-wit-${name}.mjs` : `tests/helpers/nominal-primitive-subtype-wit-${name}.mjs`;
/**
 * Independently recomputed control totals per selection.
 *
 * @param mode - Full or result-only API.
 * @param records - Number of retained records in the selection.
 */
export const nominalPrimitiveSubtypeWitExpectedControls = (mode, records) => ({
	recordControls: records * 2, executionControls: 24, toolControls: 12
	, resourceControls: 4, environmentControls: 15, packageControls: 5
	, modelControls: mode === "full" ? 6 : 5
});

const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+$/-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = bytes => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value)); return value;
};
/**
 * Absolute original receipt prefix of one launch.
 *
 * @param launch - Route, mode and attempt label.
 */
export const nominalPrimitiveSubtypeWitPrefix = launch =>
	`/app/build/vo1498-nominal-primitive-wit-${launch.route}-${launch.mode}-${launch.attempt}-${(launch.revision ?? nominalPrimitiveSubtypeWitProducer).slice(0, 7)}`;
export const nominalPrimitiveSubtypeWitPreservedRetained = Object.freeze(["start.json", "end.json", "run.tap", "controls.start.json", "controls.log", "controls.end.json"]);

/**
 * Reconcile every retained package record, control result, source and launch without rebuilding.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
export const checkNominalPrimitiveSubtypeWitEvidence = async (read = readFile) => {
	const bytes = await read(nominalPrimitiveSubtypeWitEvidence + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeWitEvidenceSha256);
	const index = json(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-wit-installed-v1");
	assert.equal(index.producerCommit, nominalPrimitiveSubtypeWitProducer);
	assert.equal(index.loadCeiling, nominalPrimitiveSubtypeWitLoadCeiling);
	assert.deepEqual(index.tools, nominalPrimitiveSubtypeWitTools);
	assert.deepEqual(index.runner, { producer: nominalPrimitiveSubtypeWitRunner.slice("/app/build/".length)
		, controls: nominalPrimitiveSubtypeWitControlsRunner.slice("/app/build/".length) });
	assert.deepEqual(index.firstRunner, { producer: nominalPrimitiveSubtypeWitFirstRunner.slice("/app/build/".length)
		, controls: nominalPrimitiveSubtypeWitFirstControlsRunner.slice("/app/build/".length) });
	assert.deepEqual(index.checkers, nominalPrimitiveSubtypeWitEvidenceCheckers);
	assert.ok(Array.isArray(index.limitations) && index.limitations.length === 10
		&& index.limitations.every(item => typeof item === "string" && item.length > 0));
	for(const entry of index.files)
	{
		assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
		const value = await read(nominalPrimitiveSubtypeWitEvidence + "/" + entry.path);
		assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
		files.set(entry.path, value);
	}
	const get = path => {
		const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
	};
	const closure = (await nominalSubtypeWitGenerator(nominalPrimitiveSubtypeWitProducer)).paths;
	const selectedSources = [...new Set([...closure, ...nominalPrimitiveSubtypeWitEvidenceSources])].sort();
	assert.deepEqual(index.generatorClosure, closure); assert.deepEqual(index.selectedSources, selectedSources);
	const expectedPaths = [];
	for(const path of selectedSources)
	{
		expectedPaths.push("sources/" + path);
		assert.deepEqual(get("sources/" + path), nominalSubtypeWitOriginal(nominalPrimitiveSubtypeWitProducer, path), path);
	}
	for(const name of index.checkers) expectedPaths.push(`checkers/${name}.mjs`);
	const producerRunner = get("runners/" + index.runner.producer), controlsRunner = get("runners/" + index.runner.controls);
	const firstRunner = get("runners/" + index.firstRunner.producer), firstControlsRunner = get("runners/" + index.firstRunner.controls);
	expectedPaths.push("runners/" + index.runner.producer, "runners/" + index.runner.controls, "runners/" + index.firstRunner.producer, "runners/" + index.firstRunner.controls);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeWitSelections);
	const checked = []; let previousFinish = 0;
	for(const [position, run] of index.runs.entries())
	{
		const launch = nominalPrimitiveSubtypeWitAcceptedLaunches[position], { route, mode } = launch, label = `${route}-${mode}`, prefix = nominalPrimitiveSubtypeWitPrefix(launch);
		for(const key of ["route", "mode", "attempt"]) assert.equal(run[key], launch[key], `${label} ${key}`);
		assert.equal(run.label, label); assert.equal(run.prefix, prefix); assert.equal(run.loadCeiling, nominalPrimitiveSubtypeWitLoadCeiling);
		assert.equal(run.worktree, nominalPrimitiveSubtypeWitWorktree); assert.deepEqual(run.runtime, runtime); assert.equal(run.floor, floor);
		const start = JSON.parse(get(`${label}/producer/start.json`)), end = JSON.parse(get(`${label}/producer/end.json`)), tap = get(`${label}/producer/run.tap`);
		assertNominalPrimitiveSubtypeWitRun({ start, end, tap, runner: producerRunner, controlsRunner, route, mode, prefix });
		assert.equal(run.started, start.started); assert.equal(run.finished, end.finished); assert.equal(run.tapSha256, sha256(tap));
		assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps the prior accepted selection`);
		const controlsStart = json(get(`${label}/controls/controls.start.json`)), controls = json(get(`${label}/controls/controls.json`));
		const controlsEnd = JSON.parse(get(`${label}/controls/controls.end.json`)), log = get(`${label}/controls/controls.log`);
		const options = { route, mode, producerCommit: nominalPrimitiveSubtypeWitProducer, runtime, floor };
		const records = path => Promise.resolve(get(`${label}/records/${path}`));
		const counts = await checkNominalPrimitiveSubtypeWitReport(records, options);
		assert.equal(counts.wasmtime, "42.0.1"); assert.equal(counts.nativeHostRequired, true); assert.equal(counts.standaloneWasi, false);
		const expected = nominalPrimitiveSubtypeWitExpectedControls(mode, counts.records.length);
		assert.deepEqual(await checkNominalPrimitiveSubtypeWitControls(records, options), expected);
		const tools = json(get(`${label}/records/tools.json`));
		assertNominalPrimitiveSubtypeWitControlsRun({ start, end, controlsStart, controls, controlsEnd, log, route, mode, prefix, expected: { ...counts, tools, controls: expected } });
		assert.equal(run.controlsFinished, controlsEnd.finished); assert.deepEqual(run.counts, counts.counts); assert.deepEqual(run.controls, expected);
		assert.equal(run.reportSha256, sha256(get(`${label}/records/report.json`)));
		for(const [path, digest] of Object.entries(controlsStart.originals))
		{
			const prefixPath = `${route}/${mode}/`; assert.ok(path.startsWith(prefixPath), path);
			const relative = path.slice(prefixPath.length);
			if(relative.startsWith("handoff/archives/")) continue;
			assert.equal(sha256(get(`${label}/records/${relative}`)), digest, path);
		}
		for(const [path, digest] of Object.entries(controlsStart.sources))
		{
			const value = path === nominalPrimitiveSubtypeWitRunner ? producerRunner
				: path === nominalPrimitiveSubtypeWitControlsRunner ? controlsRunner : get("sources/" + path);
			assert.equal(sha256(value), digest, path);
		}
		previousFinish = Date.parse(controlsEnd.finished);
		expectedPaths.push(...["start.json", "end.json", "run.tap"].map(path => `${label}/producer/${path}`)
			, ...["controls.start.json", "controls.json", "controls.end.json", "controls.log"].map(path => `${label}/controls/${path}`)
			, ...counts.records.map(path => `${label}/records/${path}`));
		checked.push({ ...counts, controls: expected, attempt: launch.attempt });
	}
	assert.equal(index.preserved.length, 1); assert.equal(nominalPrimitiveSubtypeWitPreservedLaunches.length, 1);
	const preserved = index.preserved[0], failed = nominalPrimitiveSubtypeWitPreservedLaunches[0], failedLabel = "ordinary-full-r1";
	for(const key of ["route", "mode", "attempt", "revision", "producerCode", "controlsCode"]) assert.equal(preserved[key], failed[key], key);
	assert.equal(preserved.label, failedLabel); assert.equal(preserved.prefix, nominalPrimitiveSubtypeWitPrefix(failed)); assert.equal(preserved.counted, false);
	assert.equal(preserved.worktree, nominalPrimitiveSubtypeWitFirstWorktree); assert.match(preserved.classification, /checker defect/u);
	assert.deepEqual(preserved.retained, [...nominalPrimitiveSubtypeWitPreservedRetained]);
	const failedStart = JSON.parse(get(`preserved/${failedLabel}/start.json`)), failedEnd = JSON.parse(get(`preserved/${failedLabel}/end.json`));
	const failedControlsEnd = JSON.parse(get(`preserved/${failedLabel}/controls.end.json`));
	assertNominalPrimitiveSubtypeWitPreservedLaunch({
		start: failedStart, end: failedEnd
		, tap: get(`preserved/${failedLabel}/run.tap`)
		, controlsEnd: failedControlsEnd
		, log: get(`preserved/${failedLabel}/controls.log`)
		, runner: firstRunner, controlsRunner: firstControlsRunner
		, route: failed.route, mode: failed.mode, prefix: preserved.prefix });
	json(get(`preserved/${failedLabel}/controls.start.json`));
	assert.equal(preserved.started, failedStart.started); assert.equal(preserved.finished, failedEnd.finished);
	assert.equal(preserved.controlsFinished, failedControlsEnd.finished); assert.equal(preserved.tapSha256, sha256(get(`preserved/${failedLabel}/run.tap`)));
	assert.ok(Date.parse(failedControlsEnd.finished) <= Date.parse(index.runs[0].started));
	for(const run of index.runs)
	{
		const start = JSON.parse(get(`${run.label}/producer/start.json`));
		assert.equal(start.transition.predecessorRunners.runner.sha256, sha256(firstRunner));
		assert.equal(start.transition.predecessorRunners.controlsRunner.sha256, sha256(firstControlsRunner));
	}
	expectedPaths.push(...preserved.retained.map(path => `preserved/${failedLabel}/${path}`));
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit
		, selections: checked
		, preserved: index.preserved
		, files: index.files
		, selectedSources: index.selectedSources
		, installedProfiles: ["wit-wasi"]
		, supportPromoted: false
		, hostedAcceptance: false };
};
