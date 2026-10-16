/**
 * Authenticate the complete local nineteen-base nominal JVM evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeJvmControls } from "./nominal-primitive-subtype-jvm-controls.mjs";
import { checkNominalPrimitiveSubtypeJvmReport } from "./nominal-primitive-subtype-jvm-report.mjs";
import { nominalSubtypeJvmGenerator, nominalSubtypeJvmOriginal } from "./nominal-subtype-jvm-generators.mjs";
import {
	assertNominalPrimitiveSubtypeJvmControlsRun
	, assertNominalPrimitiveSubtypeJvmPreservedLaunch
	, assertNominalPrimitiveSubtypeJvmRun
	, nominalPrimitiveSubtypeJvmAcceptedLaunches
	, nominalPrimitiveSubtypeJvmAcceptedRevision
	, nominalPrimitiveSubtypeJvmControlSources
	, nominalPrimitiveSubtypeJvmLoadCeiling
	, nominalPrimitiveSubtypeJvmPreservedLaunches
	, nominalPrimitiveSubtypeJvmProducer
	, nominalPrimitiveSubtypeJvmRunnerPaths
	, nominalPrimitiveSubtypeJvmRunnerRevisions
	, nominalPrimitiveSubtypeJvmSelections
	, nominalPrimitiveSubtypeJvmTools
	, nominalPrimitiveSubtypeJvmWorktreeOf
} from "./nominal-primitive-subtype-jvm-provenance.mjs";

export const nominalPrimitiveSubtypeJvmEvidence = "docs/evidence/nominal-primitive-subtype-jvm-20261015";
export const nominalPrimitiveSubtypeJvmEvidenceSha256 = "fc95428e32e149ff1f655ca683079f0d73863e00354b7fcd2ac8ae1f9778aad0";
export const nominalPrimitiveSubtypeJvmEvidenceSources = Object.freeze([
	"src/analyze/NativeExports.lean"
	, "src/build/native-component.mjs"
	, "src/release/package-set-receipt.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/nominal-primitive-subtype-fixture.mjs"
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/package-set.mjs"
	, "tests/helpers/type-corpus-reviewed-ir.mjs"
	, ...nominalPrimitiveSubtypeJvmControlSources
	, ...["LICENSE", "NominalPrimitiveSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/nominal-primitive-subtypes/${path}`)
]);
export const nominalPrimitiveSubtypeJvmEvidenceCheckers = Object.freeze([
	"ci-handoff", "ci-report", "consumer-records", "controls"
	, "model-records", "package", "package-records", "provenance", "report"
	, "generators", "ci-tools"
]);
/**
 * Shared Nat-era checkers live under the nominal-subtype-jvm prefix.
 *
 * @param name - Checker name from the evidence index.
 */
export const nominalPrimitiveSubtypeJvmCheckerPath = name => ["generators", "ci-tools"].includes(name)
	? `tests/helpers/nominal-subtype-jvm-${name}.mjs` : `tests/helpers/nominal-primitive-subtype-jvm-${name}.mjs`;
/**
 * Retained receipts of a preserved launch; the load-guard refusal never reached its controls phase.
 *
 * @param launch - Preserved launch descriptor.
 */
export const nominalPrimitiveSubtypeJvmPreservedRetained = launch => launch.controlsCode === null
	? ["start.json", "end.json", "run.tap"]
	: ["start.json", "end.json", "run.tap", "controls.start.json", "controls.log", "controls.end.json"];
/**
 * Absolute original receipt prefix of one launch.
 *
 * @param launch - Route, mode, attempt and optional revision.
 */
export const nominalPrimitiveSubtypeJvmPrefix = launch =>
	`/app/build/vo1495-nominal-primitive-jvm-${launch.route}-${launch.mode}-${launch.attempt}-${(launch.revision ?? nominalPrimitiveSubtypeJvmProducer).slice(0, 7)}`;
/**
 * Archive label of one preserved launch.
 *
 * @param launch - Preserved launch descriptor.
 */
export const nominalPrimitiveSubtypeJvmPreservedLabel = launch => `${launch.route}-${launch.mode}-${launch.attempt}-${launch.runnerRevision}`;
/** Every runner file that launched a retained selection, keyed by absolute path. */
export const nominalPrimitiveSubtypeJvmRunnerFiles = () => Object.keys(nominalPrimitiveSubtypeJvmRunnerRevisions)
	.flatMap(key => Object.values(nominalPrimitiveSubtypeJvmRunnerPaths(key)));

const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+$/[\]-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = bytes => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value)); return value;
};

/**
 * Reconcile every retained package record, control result, source and launch without rebuilding.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
export const checkNominalPrimitiveSubtypeJvmEvidence = async (read = readFile) => {
	const bytes = await read(nominalPrimitiveSubtypeJvmEvidence + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeJvmEvidenceSha256);
	const index = json(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-jvm-installed-v1");
	assert.equal(index.producerCommit, nominalPrimitiveSubtypeJvmProducer);
	assert.equal(index.loadCeiling, nominalPrimitiveSubtypeJvmLoadCeiling);
	assert.deepEqual(index.tools, nominalPrimitiveSubtypeJvmTools);
	assert.equal(index.acceptedRunnerRevision, nominalPrimitiveSubtypeJvmAcceptedRevision);
	assert.deepEqual(index.runners, nominalPrimitiveSubtypeJvmRunnerFiles().map(path => basename(path)));
	assert.deepEqual(index.checkers, nominalPrimitiveSubtypeJvmEvidenceCheckers);
	assert.ok(Array.isArray(index.limitations) && index.limitations.length === 9
		&& index.limitations.every(item => typeof item === "string" && item.length > 0));
	for(const entry of index.files)
	{
		assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
		const value = await read(nominalPrimitiveSubtypeJvmEvidence + "/" + entry.path);
		assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
		files.set(entry.path, value);
	}
	const get = path => {
		const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
	};
	const optional = path => files.get(path);
	const closure = (await nominalSubtypeJvmGenerator(nominalPrimitiveSubtypeJvmProducer)).paths;
	const selectedSources = [...new Set([...closure, ...nominalPrimitiveSubtypeJvmEvidenceSources])].sort();
	assert.deepEqual(index.generatorClosure, closure); assert.deepEqual(index.selectedSources, selectedSources);
	const expectedPaths = [];
	for(const path of selectedSources)
	{
		expectedPaths.push("sources/" + path);
		assert.deepEqual(get("sources/" + path), nominalSubtypeJvmOriginal(nominalPrimitiveSubtypeJvmProducer, path), path);
	}
	for(const name of index.checkers) expectedPaths.push(`checkers/${name}.mjs`);
	const runners = new Map();
	for(const path of nominalPrimitiveSubtypeJvmRunnerFiles())
	{
		runners.set(path, get("runners/" + basename(path))); expectedPaths.push("runners/" + basename(path));
	}
	const acceptedPaths = nominalPrimitiveSubtypeJvmRunnerPaths(nominalPrimitiveSubtypeJvmAcceptedRevision);
	// Preserved launches come first and must finish before any accepted launch starts.
	assert.equal(index.preserved.length, nominalPrimitiveSubtypeJvmPreservedLaunches.length);
	let previousFinish = 0;
	for(const [position, launch] of nominalPrimitiveSubtypeJvmPreservedLaunches.entries())
	{
		const preserved = index.preserved[position], label = nominalPrimitiveSubtypeJvmPreservedLabel(launch);
		for(const key of ["route", "mode", "attempt", "runnerRevision", "revision", "producerCode", "controlsCode"]) assert.equal(preserved[key], launch[key], `${label} ${key}`);
		assert.equal(preserved.label, label); assert.equal(preserved.prefix, nominalPrimitiveSubtypeJvmPrefix(launch)); assert.equal(preserved.counted, false);
		assert.equal(preserved.worktree, nominalPrimitiveSubtypeJvmWorktreeOf(launch.revision));
		assert.match(preserved.classification, launch.controlsCode === null ? /load guard/u : /controls runner defect/u);
		const retained = nominalPrimitiveSubtypeJvmPreservedRetained(launch); assert.deepEqual(preserved.retained, retained);
		const start = JSON.parse(get(`preserved/${label}/start.json`)), end = JSON.parse(get(`preserved/${label}/end.json`)), tap = get(`preserved/${label}/run.tap`);
		const controlsEndBytes = optional(`preserved/${label}/controls.end.json`);
		assertNominalPrimitiveSubtypeJvmPreservedLaunch({
			start, end, tap, runners, launch
			, route: launch.route, mode: launch.mode, prefix: preserved.prefix
			, controlsEnd: controlsEndBytes ? JSON.parse(controlsEndBytes) : undefined
			, log: optional(`preserved/${label}/controls.log`) });
		if(launch.controlsCode !== null) json(get(`preserved/${label}/controls.start.json`));
		assert.equal(preserved.started, start.started); assert.equal(preserved.finished, end.finished); assert.equal(preserved.tapSha256, sha256(tap));
		assert.ok(Date.parse(start.started) >= previousFinish);
		previousFinish = Date.parse(controlsEndBytes ? JSON.parse(controlsEndBytes).finished : end.finished);
		expectedPaths.push(...retained.map(path => `preserved/${label}/${path}`));
	}
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeJvmSelections);
	const checked = [];
	for(const [position, run] of index.runs.entries())
	{
		const launch = nominalPrimitiveSubtypeJvmAcceptedLaunches[position], { route, mode } = launch, label = `${route}-${mode}`, prefix = nominalPrimitiveSubtypeJvmPrefix(launch);
		for(const key of ["route", "mode", "attempt"]) assert.equal(run[key], launch[key], `${label} ${key}`);
		assert.equal(run.label, label); assert.equal(run.prefix, prefix); assert.equal(run.loadCeiling, nominalPrimitiveSubtypeJvmLoadCeiling);
		assert.equal(run.worktree, nominalPrimitiveSubtypeJvmWorktreeOf(nominalPrimitiveSubtypeJvmProducer)); assert.deepEqual(run.runtime, runtime); assert.equal(run.floor, floor);
		const start = JSON.parse(get(`${label}/producer/start.json`)), end = JSON.parse(get(`${label}/producer/end.json`)), tap = get(`${label}/producer/run.tap`);
		assertNominalPrimitiveSubtypeJvmRun({ start, end, tap, runners, route, mode, prefix });
		assert.equal(run.started, start.started); assert.equal(run.finished, end.finished); assert.equal(run.tapSha256, sha256(tap));
		assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps an earlier launch`);
		const controlsStart = json(get(`${label}/controls/controls.start.json`)), controls = json(get(`${label}/controls/controls.json`));
		const controlsEnd = JSON.parse(get(`${label}/controls/controls.end.json`)), log = get(`${label}/controls/controls.log`);
		assert.match(controls.checked.javaVersion, /^(?:openjdk|java) 22\.0\.2[ +]/u);
		const options = { route, mode, producerCommit: nominalPrimitiveSubtypeJvmProducer, runtime, floor, javaVersion: controls.checked.javaVersion };
		const records = path => Promise.resolve(get(`${label}/records/${path}`));
		const counts = await checkNominalPrimitiveSubtypeJvmReport(records, options);
		const recomputed = await checkNominalPrimitiveSubtypeJvmControls(records, options);
		assert.equal(recomputed.recordControls, counts.records.length * 2);
		assert.deepEqual(recomputed, controls.checked.controls);
		const { controls: ignored, tools, ...ciCounts } = controls.checked; assert.ok(ignored && tools);
		assert.deepEqual(ciCounts, counts);
		assertNominalPrimitiveSubtypeJvmControlsRun({ start, end, controlsStart, controls, controlsEnd, log, route, mode, prefix, expected: { ...counts, tools, controls: recomputed } });
		assert.equal(run.controlsFinished, controlsEnd.finished); assert.deepEqual(run.controls, recomputed);
		assert.equal(run.reportSha256, sha256(get(`${label}/records/report.json`)));
		for(const [path, digest] of Object.entries(controlsStart.originals))
		{
			const prefixPath = `${route}/${mode}/`; assert.ok(path.startsWith(prefixPath), path);
			const relativePath = path.slice(prefixPath.length);
			if(relativePath.startsWith("handoff/archives/") && relativePath.endsWith(".jar")) continue;
			assert.equal(sha256(get(`${label}/records/${relativePath}`)), digest, path);
		}
		for(const [path, digest] of Object.entries(controlsStart.sources))
		{
			const value = path === acceptedPaths.runner || path === acceptedPaths.controlsRunner ? runners.get(path) : get("sources/" + path);
			assert.equal(sha256(value), digest, path);
		}
		previousFinish = Date.parse(controlsEnd.finished);
		expectedPaths.push(...["start.json", "end.json", "run.tap"].map(path => `${label}/producer/${path}`)
			, ...["controls.start.json", "controls.json", "controls.end.json", "controls.log"].map(path => `${label}/controls/${path}`)
			, ...counts.records.map(path => `${label}/records/${path}`));
		checked.push({ ...counts, controls: recomputed, attempt: launch.attempt });
	}
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit
		, selections: checked
		, preserved: index.preserved
		, files: index.files
		, selectedSources: index.selectedSources
		, installedProfiles: ["java", "kotlin"]
		, supportPromoted: false
		, hostedAcceptance: false };
};
