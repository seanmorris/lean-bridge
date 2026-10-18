/**
 * Authenticate the four original primitive-base npm installations and their complete handoffs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeNpmReport, nominalPrimitiveSubtypeNpmRecordPaths } from "./nominal-primitive-subtype-npm-report.mjs";

export const nominalPrimitiveSubtypeNpmArchive = "docs/evidence/nominal-primitive-subtype-npm-20261014";
export const nominalPrimitiveSubtypeNpmArchiveSha256 = "302238528cb14b32f5b6c6cff5c621244e2948a4d04a33a7d4549c6cd48fc576";
export const nominalPrimitiveSubtypeNpmProducer = "caff60b7f6acf60e06988f003b2823c0d2e0319e";
export const nominalPrimitiveSubtypeNpmSelections = [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]];
export const nominalPrimitiveSubtypeNpmArchiveSources = [
	"src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean", "src/analyze/native-types.mjs"
	, "src/analyze/export-configuration.mjs", "src/analyze/reviewed-subtypes.mjs"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/build/component-refinements.mjs", "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/build/component-recursive-adapters.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-fin-guards.mjs", "src/build/refinement-mirrors.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/release/component-npm-package.mjs"
	, "src/release/component-package-receipt.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-report.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-package.mjs"
	, "tests/helpers/nominal-primitive-subtype-fixture.mjs"
	, "tests/helpers/nominal-primitive-subtype-caller-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/structural-subtype-npm-package.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/refinement-engine.mjs", "tests/helpers/lake-workspace.mjs"
	, ...["javascript.mjs", "index.mts", "results.mts", "types.mts"].map(path => "tests/fixtures/nominal-primitive-subtype-consumers/" + path)
	, ...["NominalPrimitiveSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => "tests/fixtures/onboarding/nominal-primitive-subtypes/" + path)
].sort();
const runtime = { node: "v22.23.2", platform: "linux", arch: "x64" };
const producerFiles = ["start.json", "outcome.json", "complete.json", "run.tap"];
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_@.+/-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = bytes => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value)); return value;
};
const resources = value => {
	assert.equal(value.observations.length, value.waits + 1);
	assert.ok(Number.isInteger(value.waits) && value.waits >= 0 && value.waits <= 20);
	for(const sample of value.observations)
	{
		assert.ok(sample.freeBytes >= 2 * 1024 ** 3 && sample.availableBytes >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
	}
	assert.ok(value.observations.at(-1).load < 6);
};

/**
 * Reconcile immutable run metadata, selected Git sources, runtime files and original records.
 *
 * @param read - Reader of repository-relative original archive bytes.
 */
export const checkNominalPrimitiveSubtypeNpmArchive = async (read = readFile) => {
	const bytes = await read(nominalPrimitiveSubtypeNpmArchive + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeNpmArchiveSha256);
	const index = json(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-npm-installed-v1");
	assert.equal(index.producerCommit, nominalPrimitiveSubtypeNpmProducer);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeNpmSelections);
	assert.deepEqual(index.selectedSources, nominalPrimitiveSubtypeNpmArchiveSources);
	for(const entry of index.files)
	{
		assert.ok(safePath(entry.path) && !files.has(entry.path));
		const value = await read(nominalPrimitiveSubtypeNpmArchive + "/" + entry.path);
		assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
		files.set(entry.path, value);
	}
	for(const path of index.selectedSources)
		assert.deepEqual(files.get("sources/" + path), execFileSync("git", ["show", `${index.producerCommit}:${path}`], { maxBuffer: 32 * 1024 * 1024 }));
	const expectedPaths = [
		"producer.mjs", "controls-runner.mjs", "controls-helper.mjs"
		, ...index.selectedSources.map(path => "sources/" + path)];
	const checked = []; let previousFinish = 0, sources, runtimeFiles;
	for(const run of index.runs)
	{
		const { route, mode } = run, label = route + "/" + mode;
		assert.equal(run.producerCommit, index.producerCommit); assert.deepEqual(run.runtime, runtime);
		const get = path => {
			const value = files.get(label + "/" + path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const start = json(get("producer/start.json")), end = json(get("producer/complete.json"));
		assert.deepEqual(get("producer/outcome.json"), get("producer/complete.json"));
		for(const value of [start, end])
		{
			assert.equal(value.head, index.producerCommit); assert.equal(value.route, route); assert.equal(value.mode, mode);
		}
		assert.equal(start.runnerSha256, sha256(files.get("producer.mjs")));
		assert.deepEqual(start.args, ["--max-old-space-size=3072", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs"]);
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST, "1");
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_ROUTES, route);
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_MODES, mode);
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_LAKE_RUNTIME_ROOT, start.runtimeRoot);
		assert.equal(start.selectedEnvironment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT, run.originalDirectory + "/selections");
		resources(start.resources);
		assert.deepEqual(Object.keys(start.sources).sort(), Object.keys(sources ?? start.sources).sort());
		assert.equal(Object.keys(start.sources).length, 5744); assert.equal(Object.keys(start.runtime).length, 12);
		assert.deepEqual(start.sources, sources ??= start.sources); assert.deepEqual(start.runtime, runtimeFiles ??= start.runtime);
		for(const path of index.selectedSources) assert.equal(start.sources[path], sha256(files.get("sources/" + path)), path);
		for(const [path, hash] of Object.entries(start.runtime))
		{
			assert.ok(safePath(path)); assert.equal(sha256(files.get("runtime/" + path)), hash, path);
		}
		assert.deepEqual([end.code, end.signal], [0, null]); assert.deepEqual(end.changed, []); assert.deepEqual(end.runtimeChanged, []);
		for(const key of ["pathsUnchanged", "headUnchanged", "runnerUnchanged", "runtimePathsUnchanged"]) assert.equal(end[key], true);
		assert.deepEqual(end.tests, { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 });
		const tap = get("producer/run.tap");
		assert.equal(end.bytes, tap.length); assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assert.doesNotMatch(tap.toString(), /^(?:not ok|Bail out!)|# (?:SKIP|TODO)/mu);
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		assert.ok(tap.toString().includes(`ok 1 - installed npm primitive-base nominal Subtypes reproduce and relocate ${route} ${mode}\n`));
		assert.equal(run.started, start.started); assert.equal(run.finished, end.finished);
		assert.ok(Date.parse(start.started) >= previousFinish && Date.parse(end.finished) > Date.parse(start.started));
		const report = json(get("records/report.json")); assert.equal(run.reportSha256, sha256(get("records/report.json")));
		const recordPaths = nominalPrimitiveSubtypeNpmRecordPaths(mode, report.receipt);
		const counts = await checkNominalPrimitiveSubtypeNpmReport(async path => get("records/" + path), run);
		assert.deepEqual(run.counts, counts);
		const controlStart = json(get("controls/start.json")), control = json(get("controls/complete.json"));
		for(const value of [controlStart, control])
		{
			assert.equal(value.head, index.producerCommit); assert.equal(value.route, route); assert.equal(value.mode, mode);
			assert.equal(value.sourceRoot, run.originalDirectory); assert.equal(value.compiledAgain, false); assert.equal(value.installedAcceptance, true);
		}
		assert.ok(Date.parse(controlStart.started) >= Date.parse(end.finished) && Date.parse(control.finished) >= Date.parse(controlStart.started));
		resources(controlStart.resources);
		assert.deepEqual(controlStart.sources, { ...start.sources
			, "build/vo1469-npm-ci-prepared/nominal-primitive-subtype-npm-controls.mjs": sha256(files.get("controls-helper.mjs"))
			, "/app/build/vo1469-npm-installed-controls.mjs": sha256(files.get("controls-runner.mjs")) });
		const originals = Object.fromEntries([...producerFiles.map(path => [path, sha256(get("producer/" + path))])
			, ...recordPaths.map(path => ["selections/" + label + "/" + path, sha256(get("records/" + path))])].sort(([a], [b]) => a.localeCompare(b)));
		assert.deepEqual(controlStart.originals, originals);
		assert.deepEqual(control.checked, { ...counts, recordControls: mode === "full" ? 64 : 62, reportControls: 23, adapterControls: mode === "full" ? 42 : 23 });
		assert.equal(control.originalsUnchanged, Object.keys(originals).length);
		assert.equal(control.sourcesUnchanged, 5746); assert.equal(control.runtimeFilesUnchanged, 12);
		previousFinish = Date.parse(control.finished);
		expectedPaths.push(...producerFiles.map(path => label + "/producer/" + path)
			, ...["start.json", "complete.json"].map(path => label + "/controls/" + path)
			, ...recordPaths.map(path => label + "/records/" + path));
		checked.push({ ...counts, recordControls: control.checked.recordControls, reportControls: control.checked.reportControls, adapterControls: control.checked.adapterControls });
	}
	expectedPaths.push(...Object.keys(runtimeFiles).map(path => "runtime/" + path));
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit, selections: checked
		, files: index.files, selectedSources: index.selectedSources
		, installedProfiles: ["node-javascript", "node-typescript"]
		, supportPromoted: false, requiredCiRegistered: false
		, hostedAcceptance: false
	};
};
