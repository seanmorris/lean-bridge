/**
 * Authenticate all four original primitive-base wheels and both Python interpreter floors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypePythonReport, nominalPrimitiveSubtypePythonRecords } from "./nominal-primitive-subtype-python-report.mjs";
import { assertNominalPrimitiveSubtypePythonCiTap } from "./nominal-primitive-subtype-python-ci-report.mjs";

export const nominalPrimitiveSubtypePythonArchive = "docs/evidence/nominal-primitive-subtype-python-20261014";
export const nominalPrimitiveSubtypePythonArchiveSha256 = "6ca71a8845f0025aad297334f8c72dd4e6b90228697e02bde65c84b2ff36aa7b";
export const nominalPrimitiveSubtypePythonProducer = "b1be97044c7dd9f21f58c8b63bd6a4518c145f04";
export const nominalPrimitiveSubtypePythonSelections = [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]];
export const nominalPrimitiveSubtypePythonArchiveSources = [
	"src/abi/refinements.mjs", "src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs", "src/analyze/export-configuration.mjs"
	, "src/analyze/reviewed-subtypes.mjs"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs", "src/build/native-project.mjs"
	, "src/build/native-component.mjs", "src/build/native-c-projection.mjs"
	, "src/build/native-python-artifacts.mjs"
	, "src/backends/python/copied-values.mjs"
	, "src/release/native-pypi.mjs", "src/release/package-set-receipt.mjs"
	, "tests/helpers/nominal-primitive-subtype-fixture.mjs"
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/nominal-subtype-python-generators.mjs"
	, "tests/helpers/closed-package-zip.mjs"
	, "tests/helpers/fin-container-edge-python-closure.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, ...[
		"fixture", "wheel", "install", "installed-tests", "model-records"
		, "package-records", "environment-records", "report", "controls"
		, "handoff", "ci-report"
	].map(name => "tests/helpers/nominal-primitive-subtype-python-" + name + ".mjs")
	, "tests/fixtures/nominal-primitive-subtype-consumers/python.py"
	, ...["NominalPrimitiveSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(name => "tests/fixtures/onboarding/nominal-primitive-subtypes/" + name)
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
 * Reconcile every original wheel, source snapshot, installed floor and tamper result.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
export const checkNominalPrimitiveSubtypePythonArchive = async (read = readFile) => {
	const bytes = await read(nominalPrimitiveSubtypePythonArchive + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypePythonArchiveSha256);
	const index = json(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-python-installed-v1");
	assert.equal(index.producerCommit, nominalPrimitiveSubtypePythonProducer);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypePythonSelections);
	assert.deepEqual(index.selectedSources, nominalPrimitiveSubtypePythonArchiveSources);
	for(const entry of index.files)
	{
		assert.ok(safePath(entry.path) && !files.has(entry.path));
		const value = await read(nominalPrimitiveSubtypePythonArchive + "/" + entry.path);
		assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
		files.set(entry.path, value);
	}
	for(const path of index.selectedSources)
		assert.deepEqual(files.get("sources/" + path), execFileSync("git", ["show", `${index.producerCommit}:${path}`], { maxBuffer: 32 * 1024 * 1024 }));
	const expectedPaths = ["producer.mjs", "controls-runner.mjs", ...index.selectedSources.map(path => "sources/" + path)];
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
		assert.deepEqual(start.args, ["--max-old-space-size=3072", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/nominal-primitive-subtype-python-installed-tests.mjs"]);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHON_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHON_ROUTES, route);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHON_MODES, mode);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHON_OUTPUT, run.originalDirectory + "/selections");
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
		assertNominalPrimitiveSubtypePythonCiTap(tap.toString(), route, mode);
		assert.equal(run.started, start.started); assert.equal(run.finished, end.finished);
		assert.ok(Date.parse(start.started) >= previousFinish && Date.parse(end.finished) > Date.parse(start.started));
		const report = json(get("records/report.json")), wheel = json(get("records/wheel.json"));
		assert.equal(run.reportSha256, sha256(get("records/report.json")));
		const commands = JSON.parse(start.environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHONS);
		assert.deepEqual(Object.keys(commands).sort(), ["3.11", "3.12"]);
		for(const interpreter of report.interpreters) assert.equal(start.tools[commands[interpreter.minor]], interpreter.interpreter.sha256);
		const recordPaths = nominalPrimitiveSubtypePythonRecords(route, wheel);
		const counts = await checkNominalPrimitiveSubtypePythonReport(async path => get("records/" + path), run);
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
		assert.deepEqual(controlStart.sources, { ...start.sources, "/app/build/vo1469-python-installed-controls.mjs": sha256(files.get("controls-runner.mjs")) });
		const originals = Object.fromEntries([...producerFiles.map(path => [path, sha256(get("producer/" + path))])
			, ...recordPaths.map(path => ["selections/" + label + "/" + path, sha256(get("records/" + path))])].sort(([a], [b]) => a.localeCompare(b)));
		assert.deepEqual(controlStart.originals, originals);
		assert.deepEqual(control.checked, { ...counts, recordControls: recordPaths.length * 2, environmentControls: 44, packageControls: 4, modelControls: mode === "full" ? 42 : 23 });
		assert.equal(control.originalsUnchanged, Object.keys(originals).length);
		assert.equal(control.sourcesUnchanged, Object.keys(start.sources).length + 1); assert.equal(control.toolFilesUnchanged, Object.keys(start.tools).length);
		previousFinish = Date.parse(control.finished);
		expectedPaths.push(...producerFiles.map(path => label + "/producer/" + path)
			, ...["start.json", "complete.json"].map(path => label + "/controls/" + path)
			, ...recordPaths.map(path => label + "/records/" + path));
		checked.push(control.checked);
	}
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return { producerCommit: index.producerCommit, selections: checked
		, files: index.files, selectedSources: index.selectedSources
		, installedProfiles: ["python"], supportPromoted: false
		, hostedAcceptance: false };
};
