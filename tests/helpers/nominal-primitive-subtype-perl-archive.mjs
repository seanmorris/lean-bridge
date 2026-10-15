/**
 * Authenticate four original primitive-base Perl selections, their complete CPAN packages, their real
 * control runs and every preserved non-accepted launch against two frozen producer revisions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypePerlReport, nominalPrimitiveSubtypePerlRecords } from "./nominal-primitive-subtype-perl-report.mjs";
import { assertNominalPrimitiveSubtypePerlControlsRun, assertNominalPrimitiveSubtypePerlPreservedLaunch, assertNominalPrimitiveSubtypePerlRun, nominalPrimitiveSubtypePerlRunnerVariant, nominalPrimitiveSubtypePerlRunnerVariants, nominalPrimitiveSubtypePerlSelections } from "./nominal-primitive-subtype-perl-provenance.mjs";
import { nominalSubtypePerlOriginal, nominalSubtypePerlGenerator } from "./nominal-subtype-perl-generators.mjs";

export const nominalPrimitiveSubtypePerlArchive = "docs/evidence/nominal-primitive-subtype-perl-20261015";
export const nominalPrimitiveSubtypePerlArchiveSha256 = "ec398d09b374277ea037e90a5746e1dfa747dde2bc9e7aa2d00019be759b0e78";
export const nominalPrimitiveSubtypePerlProducers = ["acc614cd17981972b3f12307a94b0eef4a957fc5", "e15acb534151d359b05b68364ab35e6ab6c77073"];
export const nominalPrimitiveSubtypePerlArchiveSelections = nominalPrimitiveSubtypePerlSelections.map(item => [...item]);
// The accepted launches in execution order, each with its frozen revision, admitted ceiling and owner.
export const nominalPrimitiveSubtypePerlAcceptedLaunches = [
	{ route: "ordinary", mode: "full", attempt: "r1", producerCommit: nominalPrimitiveSubtypePerlProducers[0], loadCeiling: 6, owner: "Claude" }
	, { route: "ordinary", mode: "result-only", attempt: "r2", producerCommit: nominalPrimitiveSubtypePerlProducers[1], loadCeiling: 8, owner: "Claude" }
	, { route: "reviewed", mode: "full", attempt: "r3", producerCommit: nominalPrimitiveSubtypePerlProducers[1], loadCeiling: 8, owner: "Codex" }
	, { route: "reviewed", mode: "result-only", attempt: "r2", producerCommit: nominalPrimitiveSubtypePerlProducers[1], loadCeiling: 12, owner: "Codex" }
];
// Every other launch under the task, preserved with its terminal outcome and never counted.
export const nominalPrimitiveSubtypePerlPreservedLaunches = [
	{ route: "ordinary", mode: "result-only", attempt: "r1"
		, producerCommit: nominalPrimitiveSubtypePerlProducers[0]
		, loadCeiling: 6, owner: "Claude", code: 1
		, reason: "C# producer host load remained at or above 6 for five minutes" }
	, { route: "reviewed", mode: "full", attempt: "r1"
		, producerCommit: nominalPrimitiveSubtypePerlProducers[1]
		, loadCeiling: 8, owner: "Claude", code: 1
		, reason: "C# producer requires 2 GiB free disk" }
	, { route: "reviewed", mode: "full", attempt: "r2"
		, producerCommit: nominalPrimitiveSubtypePerlProducers[1]
		, loadCeiling: 8, owner: "Codex", code: 0, reason: null }
	, { route: "reviewed", mode: "result-only", attempt: "r1"
		, producerCommit: nominalPrimitiveSubtypePerlProducers[1]
		, loadCeiling: 8, owner: "Codex", code: 1
		, reason: "C# producer host load remained at or above 8 for five minutes" }
];
// Only these two selected sources differ between the two producer revisions: the bounded per-run load ceiling option.
export const nominalPrimitiveSubtypePerlSourceDifferences = ["tests/helpers/nominal-primitive-subtype-perl-installed-tests.mjs", "tests/helpers/nominal-subtype-dotnet-resources.mjs"];
export const nominalPrimitiveSubtypePerlArchiveSources = [
	"src/analyze/NativeExports.lean"
	, "src/build/cpan-projection.mjs"
	, "src/build/native-component.mjs"
	, "src/build/perl-xs.mjs"
	, "src/backends/perl/Build.pm"
	, "src/backends/perl/Runtime.pm"
	, "src/backends/perl/Runtime.xs"
	, "src/backends/perl/runtime.h"
	, "src/release/cpan-install-trace.mjs"
	, "src/release/cpan-install.mjs"
	, "src/release/cpan-package.mjs"
	, "tests/fixtures/nominal-primitive-subtype-consumers/perl.pl"
	, "tests/fixtures/onboarding/nominal-primitive-subtypes/LICENSE"
	, "tests/fixtures/onboarding/nominal-primitive-subtypes/NominalPrimitiveSubtypes.lean"
	, "tests/fixtures/onboarding/nominal-primitive-subtypes/lakefile.toml"
	, "tests/fixtures/onboarding/nominal-primitive-subtypes/lean-toolchain"
	, "tests/fixtures/onboarding/nominal-primitive-subtypes/package.json"
	, "tests/helpers/checked-record-perl-install.mjs"
	, "tests/helpers/closed-package-tar.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/nominal-primitive-subtype-fixture.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-ci-report.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-controls.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-fixture.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-handoff.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-install.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-installed-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-model-records.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-model.pl"
	, "tests/helpers/nominal-primitive-subtype-perl-package-records.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-report.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/nominal-subtype-perl-generators.mjs"
	, "tests/helpers/package-set.mjs"
];
const checkers = ["report", "model-records", "package-records", "handoff", "controls", "ci-report", "provenance", "generators", "closed-package-tar"];
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+/-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = bytes => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value)); return value;
};
const prefixOf = (route, mode, attempt, producerCommit) => `/app/build/vo1493-nominal-primitive-perl-${route}-${mode}-${attempt}-${producerCommit.slice(0, 7)}`;

/**
 * Reconcile the original CPAN archives, receipts, control runs, preserved launches and frozen sources.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
export const checkNominalPrimitiveSubtypePerlArchive = async (read = readFile) => {
	const bytes = await read(nominalPrimitiveSubtypePerlArchive + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypePerlArchiveSha256);
	const index = json(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-perl-installed-v1");
	assert.deepEqual(index.producerCommits, nominalPrimitiveSubtypePerlProducers);
	assert.deepEqual(index.runnerVariants, nominalPrimitiveSubtypePerlRunnerVariants.map(item => ({ ...item, producer: item.producer.slice("/app/build/".length), controls: item.controls.slice("/app/build/".length) })));
	assert.deepEqual(index.checkers, checkers); assert.deepEqual(index.sourceDifferences, nominalPrimitiveSubtypePerlSourceDifferences);
	assert.ok(Array.isArray(index.limitations) && index.limitations.length === 9 && index.limitations.every(item => typeof item === "string" && item.length > 0));
	for(const entry of index.files)
	{
		assert.ok(safePath(entry.path) && !files.has(entry.path));
		const value = await read(nominalPrimitiveSubtypePerlArchive + "/" + entry.path);
		assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
		files.set(entry.path, value);
	}
	const get = path => {
		const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
	};
	const closure = (await nominalSubtypePerlGenerator(nominalPrimitiveSubtypePerlProducers[1])).paths;
	assert.deepEqual(index.generatorClosure, closure);
	assert.deepEqual(index.selectedSources, [...new Set([...closure, ...nominalPrimitiveSubtypePerlArchiveSources])].sort());
	const expectedPaths = [];
	for(const path of index.selectedSources)
	{
		const retained = nominalPrimitiveSubtypePerlProducers.map(revision => {
			expectedPaths.push(`sources/${revision}/${path}`);
			const value = get(`sources/${revision}/${path}`);
			assert.deepEqual(value, nominalSubtypePerlOriginal(revision, path), `${revision}:${path}`);
			return value;
		});
		assert.equal(retained[0].equals(retained[1]), !nominalPrimitiveSubtypePerlSourceDifferences.includes(path), path);
	}
	for(const name of checkers) expectedPaths.push(`checkers/${name}.mjs`);
	const runnerBytes = new Map();
	for(const variant of nominalPrimitiveSubtypePerlRunnerVariants) for(const path of [variant.producer, variant.controls])
	{
		const name = "runners/" + path.slice("/app/build/".length);
		expectedPaths.push(name); runnerBytes.set(path, get(name));
	}
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypePerlArchiveSelections);
	const checked = []; let previousFinish = 0;
	for(const [position, run] of index.runs.entries())
	{
		const launch = nominalPrimitiveSubtypePerlAcceptedLaunches[position], { route, mode } = launch, label = `${route}-${mode}`;
		for(const key of ["route", "mode", "attempt", "producerCommit", "loadCeiling", "owner"]) assert.equal(run[key], launch[key], `${label} ${key}`);
		assert.equal(run.label, label); assert.equal(run.prefix, prefixOf(route, mode, launch.attempt, launch.producerCommit));
		assert.deepEqual(run.runtime, runtime); assert.equal(run.floor, floor);
		const variant = nominalPrimitiveSubtypePerlRunnerVariant(launch.producerCommit, launch.loadCeiling);
		assert.equal(run.worktree, variant.worktree);
		assert.deepEqual(run.runner, { producer: variant.producer.slice("/app/build/".length), controls: variant.controls.slice("/app/build/".length) });
		const start = JSON.parse(get(`${label}/producer/start.json`)), end = JSON.parse(get(`${label}/producer/end.json`)), tap = get(`${label}/producer/run.tap`);
		assertNominalPrimitiveSubtypePerlRun({
			start, end, tap
			, runner: runnerBytes.get(variant.producer)
			, controlsRunner: runnerBytes.get(variant.controls)
			, route, mode, prefix: run.prefix
			, producerCommit: launch.producerCommit, floor, variant });
		assert.equal(run.started, start.started); assert.equal(run.finished, end.finished); assert.equal(run.tapSha256, sha256(tap));
		assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps the previous selection`);
		const controlsStart = json(get(`${label}/controls/controls.start.json`)), controls = json(get(`${label}/controls/controls.json`));
		const controlsEnd = JSON.parse(get(`${label}/controls/controls.end.json`)), log = get(`${label}/controls/controls.log`);
		const receipt = json(get(`${label}/records/build-0/package-set-receipt.json`));
		const recordPaths = nominalPrimitiveSubtypePerlRecords(route, receipt);
		const counts = await checkNominalPrimitiveSubtypePerlReport(async path => get(`${label}/records/${path}`), { route, mode, producerCommit: launch.producerCommit, runtime, floor });
		const expectedControls = { executions: 16, recordControls: counts.records * 2, packageControls: 48, handoffControls: 4, modelControls: mode === "full" ? 43 : 24 };
		assertNominalPrimitiveSubtypePerlControlsRun({
			start, end, controlsStart, controls, controlsEnd, log
			, route, mode, prefix: run.prefix
			, producerCommit: launch.producerCommit, variant
			, expected: expectedControls });
		assert.deepEqual(controls.checked, { ...counts, ...expectedControls });
		assert.deepEqual(run.controls, { recordControls: expectedControls.recordControls, packageControls: 48, handoffControls: 4, modelControls: expectedControls.modelControls });
		assert.equal(run.controlsFinished, controlsEnd.finished);
		for(const [key, value] of Object.entries(counts)) assert.deepEqual(run[key], value, `${label} ${key}`);
		assert.equal(run.reportSha256, sha256(get(`${label}/records/report.json`)));
		assert.equal(run.runnerLog, files.has(`${label}/producer/runner.log`));
		previousFinish = Date.parse(controlsEnd.finished);
		expectedPaths.push(...["start.json", "end.json", "run.tap", ...run.runnerLog ? ["runner.log"] : []].map(path => `${label}/producer/${path}`)
			, ...["controls.start.json", "controls.json", "controls.end.json", "controls.log"].map(path => `${label}/controls/${path}`)
			, ...recordPaths.map(path => `${label}/records/${path}`));
		checked.push({ ...counts, ...expectedControls, loadCeiling: launch.loadCeiling, attempt: launch.attempt, owner: launch.owner });
	}
	assert.deepEqual(index.preserved.map(item => item.label), nominalPrimitiveSubtypePerlPreservedLaunches.map(item => `${item.route}-${item.mode}-${item.attempt}`));
	for(const [position, record] of index.preserved.entries())
	{
		const launch = nominalPrimitiveSubtypePerlPreservedLaunches[position], label = record.label;
		for(const key of ["route", "mode", "attempt", "producerCommit", "loadCeiling", "owner", "code", "reason"]) assert.deepEqual(record[key], launch[key], `${label} ${key}`);
		assert.equal(record.counted, false); assert.ok(typeof record.classification === "string" && record.classification.length > 0);
		assert.equal(record.prefix, prefixOf(launch.route, launch.mode, launch.attempt, launch.producerCommit));
		const variant = nominalPrimitiveSubtypePerlRunnerVariant(launch.producerCommit, launch.loadCeiling);
		assert.deepEqual(record.runner, { producer: variant.producer.slice("/app/build/".length), controls: variant.controls.slice("/app/build/".length) });
		const startBytes = get(`preserved/${label}/start.json`), endBytes = get(`preserved/${label}/end.json`), tap = get(`preserved/${label}/run.tap`);
		const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
		assertNominalPrimitiveSubtypePerlPreservedLaunch({
			start, end, tap
			, runner: runnerBytes.get(variant.producer)
			, controlsRunner: runnerBytes.get(variant.controls)
			, route: launch.route, mode: launch.mode, prefix: record.prefix
			, producerCommit: launch.producerCommit, floor, variant
			, code: launch.code, reason: launch.reason });
		assert.equal(record.started, start.started); assert.equal(record.finished, end.finished);
		assert.equal(record.tapSha256, sha256(tap)); assert.equal(record.startSha256, sha256(startBytes)); assert.equal(record.endSha256, sha256(endBytes));
		assert.ok(Array.isArray(record.retained) && record.retained.slice(0, 3).join() === "start.json,end.json,run.tap");
		assert.equal(record.retained.includes("controls.json"), launch.code === 0, `${label}: controls run only after a green producer`);
		for(const name of record.retained) expectedPaths.push(`preserved/${label}/${name}`);
	}
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return { producerCommits: index.producerCommits
		, selections: checked, preserved: index.preserved
		, files: index.files, selectedSources: index.selectedSources
		, installedProfiles: ["perl"], supportPromoted: false
		, hostedAcceptance: false };
};
