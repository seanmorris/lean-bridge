/**
 * Authenticate the complete local primitive-base nominal Ruby evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeRubyControls } from "./nominal-primitive-subtype-ruby-controls.mjs";
import { checkNominalPrimitiveSubtypeRubyReport, nominalPrimitiveSubtypeRubyRecords } from "./nominal-primitive-subtype-ruby-report.mjs";
import { nominalSubtypeRubyGenerator } from "./nominal-subtype-ruby-generators.mjs";
import {
	assertNominalPrimitiveSubtypeRubyControlsRun
	, assertNominalPrimitiveSubtypeRubyPreservedLaunch
	, assertNominalPrimitiveSubtypeRubyRun
	, nominalPrimitiveSubtypeRubyAcceptedLaunches
	, nominalPrimitiveSubtypeRubyControlSources
	, nominalPrimitiveSubtypeRubyControlsRunner
	, nominalPrimitiveSubtypeRubyLoadCeiling
	, nominalPrimitiveSubtypeRubyPreservedLaunches
	, nominalPrimitiveSubtypeRubyProducer
	, nominalPrimitiveSubtypeRubyRunner
	, nominalPrimitiveSubtypeRubySelections
	, nominalPrimitiveSubtypeRubyWorktree
} from "./nominal-primitive-subtype-ruby-provenance.mjs";

export const nominalPrimitiveSubtypeRubyEvidence = "docs/evidence/nominal-primitive-subtype-ruby-20261015";
export const nominalPrimitiveSubtypeRubyEvidenceSha256 = "a44de8f24633c8fd7d9761fd05b6618536df4f76679acee63033c6cee58f2c3f";
export const nominalPrimitiveSubtypeRubyEvidenceSources = Object.freeze([
	"src/analyze/NativeExports.lean"
	, "src/build/native-component.mjs"
	, "src/build/native-ruby-artifacts.mjs"
	, "src/release/native-rubygems.mjs"
	, "src/release/package-set-receipt.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/nominal-primitive-subtype-fixture.mjs"
	, "tests/helpers/package-set.mjs"
	, ...nominalPrimitiveSubtypeRubyControlSources
	, ...["LICENSE", "NominalPrimitiveSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/nominal-primitive-subtypes/${path}`)
]);
export const nominalPrimitiveSubtypeRubyEvidenceCheckers = Object.freeze([
	"archive", "ci-report", "controls", "environment-records", "model-records"
	, "package", "package-records", "provenance", "report", "generators"
]);

const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36", rubyVersion = "3.3.12";
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+/-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = bytes => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value)); return value;
};
const prefixOf = ({ route, mode, attempt }) => `/app/build/vo1492-nominal-primitive-ruby-${route}-${mode}-${attempt}-aaadc4f`;

/**
 * Reconcile every retained gem, control result, source and failed launch without rebuilding.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
export const checkNominalPrimitiveSubtypeRubyEvidence = async (read = readFile) => {
	const bytes = await read(nominalPrimitiveSubtypeRubyEvidence + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeRubyEvidenceSha256);
	const index = json(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-ruby-installed-v1");
	assert.equal(index.producerCommit, nominalPrimitiveSubtypeRubyProducer);
	assert.equal(index.loadCeiling, nominalPrimitiveSubtypeRubyLoadCeiling);
	assert.deepEqual(index.runner, { producer: nominalPrimitiveSubtypeRubyRunner.slice("/app/build/".length)
		, controls: nominalPrimitiveSubtypeRubyControlsRunner.slice("/app/build/".length) });
	assert.deepEqual(index.checkers, nominalPrimitiveSubtypeRubyEvidenceCheckers);
	assert.ok(Array.isArray(index.limitations) && index.limitations.length === 8
		&& index.limitations.every(item => typeof item === "string" && item.length > 0));
	for(const entry of index.files)
	{
		assert.ok(safePath(entry.path) && !files.has(entry.path));
		const value = await read(nominalPrimitiveSubtypeRubyEvidence + "/" + entry.path);
		assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
		files.set(entry.path, value);
	}
	const get = path => {
		const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
	};
	const closure = (await nominalSubtypeRubyGenerator(nominalPrimitiveSubtypeRubyProducer)).paths;
	const selectedSources = [...new Set([...closure, ...nominalPrimitiveSubtypeRubyEvidenceSources])].sort();
	assert.deepEqual(index.generatorClosure, closure); assert.deepEqual(index.selectedSources, selectedSources);
	const expectedPaths = [];
	for(const path of selectedSources)
	{
		expectedPaths.push("sources/" + path);
		assert.deepEqual(get("sources/" + path), execFileSync("git", ["show", `${nominalPrimitiveSubtypeRubyProducer}:${path}`], { maxBuffer: 32 * 1024 * 1024 }), path);
	}
	for(const name of index.checkers) expectedPaths.push(`checkers/${name}.mjs`);
	const producerRunner = get("runners/" + index.runner.producer), controlsRunner = get("runners/" + index.runner.controls);
	expectedPaths.push("runners/" + index.runner.producer, "runners/" + index.runner.controls);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeRubySelections);
	const checked = []; let previousFinish = 0;
	for(const [position, run] of index.runs.entries())
	{
		const launch = nominalPrimitiveSubtypeRubyAcceptedLaunches[position], { route, mode } = launch, label = `${route}-${mode}`, prefix = prefixOf(launch);
		for(const key of ["route", "mode", "attempt"]) assert.equal(run[key], launch[key], `${label} ${key}`);
		assert.equal(run.label, label); assert.equal(run.prefix, prefix); assert.equal(run.loadCeiling, nominalPrimitiveSubtypeRubyLoadCeiling);
		assert.equal(run.worktree, nominalPrimitiveSubtypeRubyWorktree); assert.deepEqual(run.runtime, runtime);
		assert.equal(run.floor, floor); assert.equal(run.rubyVersion, rubyVersion);
		const start = JSON.parse(get(`${label}/producer/start.json`)), end = JSON.parse(get(`${label}/producer/end.json`)), tap = get(`${label}/producer/run.tap`);
		assertNominalPrimitiveSubtypeRubyRun({ start, end, tap, runner: producerRunner, controlsRunner, route, mode, prefix });
		assert.equal(run.started, start.started); assert.equal(run.finished, end.finished); assert.equal(run.tapSha256, sha256(tap));
		assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps the prior accepted selection`);
		const controlsStart = json(get(`${label}/controls/controls.start.json`)), controls = json(get(`${label}/controls/controls.json`));
		const controlsEnd = JSON.parse(get(`${label}/controls/controls.end.json`)), log = get(`${label}/controls/controls.log`);
		const gem = json(get(`${label}/records/gem.json`)), recordPaths = nominalPrimitiveSubtypeRubyRecords(route, gem);
		const counts = await checkNominalPrimitiveSubtypeRubyReport(path => Promise.resolve(get(`${label}/records/${path}`))
			, { route, mode, producerCommit: nominalPrimitiveSubtypeRubyProducer, runtime, floor, rubyVersion });
		const controlled = await checkNominalPrimitiveSubtypeRubyControls(path => Promise.resolve(get(`${label}/records/${path}`))
			, { route, mode, producerCommit: nominalPrimitiveSubtypeRubyProducer, runtime, floor, rubyVersion });
		const expected = {
			...counts
			, recordControls: recordPaths.length * 2
			, environmentControls: 12
			, packageControls: 4
			, modelControls: mode === "full" ? 42 : 23
			, executionControls: 20
		};
		assert.deepEqual(controlled, expected);
		assertNominalPrimitiveSubtypeRubyControlsRun({ start, end, controlsStart, controls, controlsEnd, log, route, mode, prefix, expected });
		assert.equal(run.controlsFinished, controlsEnd.finished); assert.deepEqual(run.counts, counts); assert.deepEqual(run.controls, {
			recordControls: expected.recordControls
			, environmentControls: 12
			, packageControls: 4
			, modelControls: expected.modelControls, executionControls: 20
		});
		assert.equal(run.reportSha256, sha256(get(`${label}/records/report.json`)));
		for(const [path, digest] of Object.entries(controlsStart.originals))
		{
			const prefixPath = `${route}/${mode}/`; assert.ok(path.startsWith(prefixPath), path);
			assert.equal(sha256(get(`${label}/records/${path.slice(prefixPath.length)}`)), digest, path);
		}
		for(const [path, digest] of Object.entries(controlsStart.sources))
		{
			const value = path === nominalPrimitiveSubtypeRubyRunner ? producerRunner
				: path === nominalPrimitiveSubtypeRubyControlsRunner ? controlsRunner : get("sources/" + path);
			assert.equal(sha256(value), digest, path);
		}
		previousFinish = Date.parse(controlsEnd.finished);
		expectedPaths.push(...["start.json", "end.json", "run.tap"].map(path => `${label}/producer/${path}`)
			, ...["controls.start.json", "controls.json", "controls.end.json", "controls.log"].map(path => `${label}/controls/${path}`)
			, ...recordPaths.map(path => `${label}/records/${path}`));
		checked.push({ ...counts, ...run.controls, attempt: launch.attempt, loadCeiling: nominalPrimitiveSubtypeRubyLoadCeiling });
	}
	assert.equal(index.preserved.length, 1); const preserved = index.preserved[0], failed = nominalPrimitiveSubtypeRubyPreservedLaunches[0];
	for(const key of ["route", "mode", "attempt", "code", "stopReason"]) assert.equal(preserved[key], failed[key], key);
	assert.equal(preserved.label, "ordinary-full-r1"); assert.equal(preserved.prefix, prefixOf(failed)); assert.equal(preserved.counted, false);
	assert.match(preserved.classification, /disk-floor/u);
	const failedStart = JSON.parse(get("preserved/ordinary-full-r1/start.json"));
	const failedEnd = JSON.parse(get("preserved/ordinary-full-r1/end.json"));
	const failedTap = get("preserved/ordinary-full-r1/run.tap");
	assertNominalPrimitiveSubtypeRubyPreservedLaunch({
		start: failedStart
		, end: failedEnd
		, tap: failedTap
		, runner: producerRunner
		, controlsRunner
		, route: failed.route
		, mode: failed.mode
		, prefix: preserved.prefix });
	assert.equal(preserved.started, failedStart.started); assert.equal(preserved.finished, failedEnd.finished);
	const retainedArchive = get("preserved/ordinary-full-r1/failed-inputs.tar.gz");
	assert.equal(sha256(retainedArchive), "1fc4267ac4e3a73ab7c0bd4d0f0cb37e6d9042ba15ee757d1c9236dadd6bcde5");
	assert.equal(sha256(gunzipSync(retainedArchive)), "041387da3b460ea13f23a5b3ca5eb3d54c126b5e5af8de5c92337eae8972270e");
	assert.equal(sha256(get("preserved/ordinary-full-r1/failed-inputs.sha256")), "92f374c5cc7096b9d45c5d734668b9829a26281ab6350963be35580f7ae6ad85");
	assert.equal(sha256(get("preserved/ordinary-full-r1/failed-inputs.list")), "bd26c0092ee3562904678714ac9f9ffffeaf5c6107b9f1cbd765ca528077ce2c");
	assert.deepEqual(preserved.retained, ["start.json", "end.json", "run.tap", "failed-inputs.tar.gz", "failed-inputs.sha256", "failed-inputs.list"]);
	expectedPaths.push(...preserved.retained.map(path => `preserved/ordinary-full-r1/${path}`));
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit
		, selections: checked
		, preserved: index.preserved
		, files: index.files
		, selectedSources: index.selectedSources
		, installedProfiles: ["ruby"]
		, supportPromoted: false
		, hostedAcceptance: false };
};
