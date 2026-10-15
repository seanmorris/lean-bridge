/**
 * Authenticate four original primitive-base C/C++ selections and complete native packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeNativeReport, nominalPrimitiveSubtypeNativeRecords } from "./nominal-primitive-subtype-native-report.mjs";
import { assertNominalPrimitiveSubtypeNativeCiTap } from "./nominal-primitive-subtype-native-ci-report.mjs";

export const nominalPrimitiveSubtypeNativeArchive = "docs/evidence/nominal-primitive-subtype-native-20261014";
export const nominalPrimitiveSubtypeNativeArchiveSha256 = "354247ce913b8957e09c5dae6ce99fec835952d3419a73039880dca0a8875f98";
export const nominalPrimitiveSubtypeNativeProducer = "e5b353c3550acdb66660e150a809ea99b6ef1374";
export const nominalPrimitiveSubtypeNativeSelections = [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]];
export const nominalPrimitiveSubtypeNativeArchiveSources = [
	"src/abi/component-copied.mjs"
	, "src/abi/component-recursive.mjs"
	, "src/abi/component-scalars.mjs"
	, "src/abi/generic-specialization.mjs"
	, "src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/callback-signature.mjs"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/copied-metadata-graph.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/generator-configuration.mjs"
	, "src/analyze/native-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/owned-aggregate-policy.mjs"
	, "src/analyze/owned-metadata-graph.mjs"
	, "src/analyze/package-license.mjs"
	, "src/analyze/package-metadata.mjs"
	, "src/analyze/reviewed-instantiation.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-subtypes.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/analyze/spdx-data.json"
	, "src/backends/c/fin-diagnostic.mjs"
	, "src/backends/c/generate.mjs"
	, "src/backends/c/gmp-projection.mjs"
	, "src/backends/c/gmp-values.mjs"
	, "src/backends/c/gmp.source.tar.xz"
	, "src/backends/c/native-callables.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/c/package-audit.mjs"
	, "src/backends/c/primitive-surface.mjs"
	, "src/backends/cpp/boost.mjs"
	, "src/backends/cpp/boost.source.json"
	, "src/backends/cpp/callables.mjs"
	, "src/backends/cpp/copied-values.mjs"
	, "src/backends/cpp/generate.mjs"
	, "src/backends/cpp/primitives.mjs"
	, "src/backends/perl/naming.mjs"
	, "src/backends/php/callables.mjs"
	, "src/backends/php/copied-equality.mjs"
	, "src/backends/php/copied-model.mjs"
	, "src/backends/php/copied-names.mjs"
	, "src/backends/php/copied-variants.mjs"
	, "src/binding-ir/canonical.mjs"
	, "src/binding-ir/contract.mjs"
	, "src/binding-ir/sha256.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-component.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-project.mjs"
	, "src/build/refinement-mirrors.mjs"
	, "src/capsule/contract.mjs"
	, "src/capsule/node.mjs"
	, "src/release/component-package-receipt.mjs"
	, "src/release/native-c-family.mjs"
	, "src/release/package-set-receipt.mjs"
	, "tests/fixtures/nominal-primitive-subtype-consumers/c.c"
	, "tests/fixtures/nominal-primitive-subtype-consumers/cpp.cpp"
	, "tests/fixtures/onboarding/nominal-primitive-subtypes/LICENSE"
	, "tests/fixtures/onboarding/nominal-primitive-subtypes/NominalPrimitiveSubtypes.lean"
	, "tests/fixtures/onboarding/nominal-primitive-subtypes/lakefile.toml"
	, "tests/fixtures/onboarding/nominal-primitive-subtypes/lean-toolchain"
	, "tests/fixtures/onboarding/nominal-primitive-subtypes/package.json"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/module-closure.mjs"
	, "tests/helpers/nominal-primitive-subtype-fixture.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-ci-report.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-controls.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-fixture.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-generators.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-installed-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-model-records.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-package-records.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-report.mjs"
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-archives.mjs"
	, "tests/helpers/package-set.mjs"
].sort();
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" };
const producerFiles = ["start.json", "outcome.json", "complete.json", "run.tap"];
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+/-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = bytes => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value)); return value;
};
const resources = value => {
	assert.ok(Number.isInteger(value.waits) && value.waits >= 0 && value.waits <= 20);
	assert.equal(value.observations.length, value.waits + 1);
	for(const sample of value.observations)
	{
		assert.ok(sample.freeBytes >= 2 * 1024 ** 3 && sample.availableBytes >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
	}
	assert.ok(value.observations.at(-1).load < 6);
};

/**
 * Reconcile original C/C++ archives, public callers, relocation and tamper results.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
export const checkNominalPrimitiveSubtypeNativeArchive = async (read = readFile) => {
	const bytes = await read(nominalPrimitiveSubtypeNativeArchive + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeNativeArchiveSha256);
	const index = json(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-native-installed-v1");
	assert.equal(index.producerCommit, nominalPrimitiveSubtypeNativeProducer);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeNativeSelections);
	assert.deepEqual(index.selectedSources, nominalPrimitiveSubtypeNativeArchiveSources);
	for(const entry of index.files)
	{
		assert.ok(safePath(entry.path) && !files.has(entry.path));
		const value = await read(nominalPrimitiveSubtypeNativeArchive + "/" + entry.path);
		assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
		files.set(entry.path, value);
	}
	for(const path of index.selectedSources)
		assert.deepEqual(files.get("sources/" + path), execFileSync("git", ["show", `${index.producerCommit}:${path}`], { maxBuffer: 32 * 1024 * 1024 }));
	const expectedPaths = ["producer.mjs", "controls-runner.mjs", "process-capture.mjs", ...index.selectedSources.map(path => "sources/" + path)];
	const checked = []; let previousFinish = 0, sharedSources, sharedTools;
	for(const run of index.runs)
	{
		const { route, mode } = run, label = route + "/" + mode;
		assert.equal(run.producerCommit, index.producerCommit); assert.deepEqual(run.runtime, runtime); assert.equal(run.floor, "2.36");
		const get = path => {
			const value = files.get(label + "/" + path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const start = json(get("producer/start.json")), end = json(get("producer/complete.json"));
		assert.deepEqual(get("producer/outcome.json"), get("producer/complete.json"));
		for(const value of [start, end])
		{ assert.equal(value.head, index.producerCommit); assert.equal(value.route, route); assert.equal(value.mode, mode); }
		assert.equal(start.runnerSha256, sha256(files.get("producer.mjs")));
		assert.deepEqual(start.args, ["--max-old-space-size=3072", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/nominal-primitive-subtype-native-installed-tests.mjs"]);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NATIVE_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NATIVE_ROUTES, route);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NATIVE_MODES, mode);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NATIVE_OUTPUT, run.originalDirectory + "/selections");
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		for(const key of ["LEAN_NUM_THREADS", "OMP_NUM_THREADS", "CMAKE_BUILD_PARALLEL_LEVEL"]) assert.equal(start.environment[key], "1");
		assert.equal(start.environment.MAKEFLAGS, "-j1"); resources(start.resources);
		assert.deepEqual(start.sources, sharedSources ??= start.sources); assert.deepEqual(start.tools, sharedTools ??= start.tools);
		for(const path of index.selectedSources) assert.equal(start.sources[path], sha256(files.get("sources/" + path)), path);
		assert.deepEqual([end.code, end.signal], [0, null]); assert.deepEqual(end.changed, []); assert.deepEqual(end.toolsChanged, []);
		for(const key of ["pathsUnchanged", "headUnchanged", "runnerUnchanged"]) assert.equal(end[key], true);
		assert.deepEqual(end.tests, { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 });
		const tap = get("producer/run.tap");
		assert.equal(end.bytes, tap.length); assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assertNominalPrimitiveSubtypeNativeCiTap(tap.toString(), route, mode);
		assert.equal(run.started, start.started); assert.equal(run.finished, end.finished);
		assert.ok(Date.parse(start.started) >= previousFinish && Date.parse(end.finished) > Date.parse(start.started));
		const receipt = json(get("records/build-0/package-set-receipt.json"));
		assert.equal(run.reportSha256, sha256(get("records/report.json")));
		const recordPaths = nominalPrimitiveSubtypeNativeRecords(route, receipt);
		const counts = await checkNominalPrimitiveSubtypeNativeReport(async path => get("records/" + path), run);
		assert.deepEqual(run.counts, counts);
		const controlStart = json(get("controls/start.json")), control = json(get("controls/complete.json"));
		for(const value of [controlStart, control])
		{
			assert.equal(value.head, index.producerCommit); assert.equal(value.route, route); assert.equal(value.mode, mode);
			assert.equal(value.sourceRoot, run.originalDirectory); assert.equal(value.compiledAgain, false);
		}
		assert.equal(control.installedAcceptance, true);
		assert.ok(Date.parse(controlStart.started) >= Date.parse(end.finished) && Date.parse(control.finished) >= Date.parse(controlStart.started));
		resources(controlStart.resources);
		assert.deepEqual(controlStart.sources, { ...start.sources, "/app/build/vo1469-native-installed-controls.mjs": sha256(files.get("controls-runner.mjs")) });
		const originals = Object.fromEntries([...producerFiles.map(path => [path, sha256(get("producer/" + path))])
			, ...recordPaths.map(path => ["selections/" + label + "/" + path, sha256(get("records/" + path))])].sort(([a], [b]) => a.localeCompare(b)));
		assert.deepEqual(controlStart.originals, originals);
		assert.deepEqual(control.checked, { ...counts, recordControls: recordPaths.length * 2, reportControls: 41, packageControls: 12, modelControls: mode === "full" ? 42 : 23 });
		assert.equal(control.originalsUnchanged, Object.keys(originals).length);
		assert.equal(control.sourcesUnchanged, Object.keys(start.sources).length + 1); assert.equal(control.toolFilesUnchanged, Object.keys(start.tools).length);
		for(const kind of ["producer", "controls"])
		{
			const process = json(get(`process/${kind}.json`)), log = get(`process/${kind}.log`);
			const captureAttempt = kind === "producer" ? run.producerAttempt : run.controlsAttempt;
			const fourth = kind === "producer" ? start.foundationAttempt : run.controlsAttempt;
			for(const value of [run.producerAttempt, captureAttempt, fourth]) assert.match(value, /^r[1-9][0-9]*$/u);
			assert.equal(process.kind, kind); assert.equal(process.route, route); assert.equal(process.mode, mode);
			assert.equal(process.third, run.producerAttempt); assert.equal(process.fourth, fourth);
			assert.deepEqual([process.code, process.signal], [0, null]); assert.equal(process.spawnError, undefined);
			const runner = kind === "producer" ? "build/vo1469-native-produce.mjs" : "build/vo1469-native-installed-controls.mjs";
			assert.deepEqual(process.args, ["--max-old-space-size=3072", runner, route, mode, run.producerAttempt, fourth]);
			assert.equal(process.wrapperSha256, sha256(files.get("process-capture.mjs")));
			assert.equal(process.runnerSha256, sha256(files.get(kind === "producer" ? "producer.mjs" : "controls-runner.mjs")));
			assert.equal(process.log, `build/vo1469-native-${kind}-process-${route}-${mode}-${captureAttempt}.log`);
			assert.equal(process.bytes, log.length); assert.equal(process.sha256, sha256(log));
			const first = kind === "producer" ? start : controlStart, last = kind === "producer" ? end : control;
			assert.ok(Date.parse(process.started) <= Date.parse(first.started) && Date.parse(process.finished) >= Date.parse(last.finished));
			expectedPaths.push(label + `/process/${kind}.json`, label + `/process/${kind}.log`);
		}
		previousFinish = Date.parse(control.finished);
		expectedPaths.push(...producerFiles.map(path => label + "/producer/" + path)
			, ...["start.json", "complete.json"].map(path => label + "/controls/" + path)
			, ...recordPaths.map(path => label + "/records/" + path));
		checked.push(control.checked);
	}
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return { producerCommit: index.producerCommit, selections: checked
		, files: index.files, selectedSources: index.selectedSources
		, installedProfiles: ["c", "cpp"], supportPromoted: false
		, hostedAcceptance: false };
};
