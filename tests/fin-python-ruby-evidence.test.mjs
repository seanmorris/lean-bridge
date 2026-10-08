/**
 * Keep each observed runtime and source route tied to its own immutable execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { assertFinPythonRubyExecution, assertFinPythonRubyReport, finPythonRubyDirectory, finPythonRubyRevision, finPythonRubyRuntimes, finPythonRubySourcePaths, finPythonRubySteps } from "./helpers/fin-python-ruby-evidence.mjs";
import "./helpers/fin-python-ruby-archive-source-history-tests.mjs";
import "./helpers/fin-runtime-provenance-source-history-tests.mjs";
import "./helpers/fin-python-ruby-promotion-tests.mjs";
import "./helpers/fin-rust-evidence-tests.mjs";
import "./helpers/checked-record-evidence-tests.mjs";
import "./helpers/fin-dotnet-hosted-evidence-tests.mjs";
import "./helpers/archive-batch-source-history-tests.mjs";
import "./helpers/fin-native-batch-promotion-tests.mjs";

const receipt = async () => {
	const bytes = await readFile(`${finPythonRubyDirectory}/receipt-v2.json`);
	assert.equal(sha256(bytes), "bf9d9e50056cf76630820935709134a7e4033f45721d380d4af2febe5e82dd98");
	return JSON.parse(bytes);
};
const readOriginal = async reference => {
	const bytes = await readFile(reference.path);
	assert.equal(bytes.length, reference.bytes);
	assert.equal(sha256(bytes), reference.sha256, reference.path);
	return bytes;
};

test("Python/Ruby evidence authenticates all 18 original reports and all 27 artifacts", async () => {
	const record = await receipt();
	assert.equal(record.schemaVersion, 2); assert.deepEqual(record.planNodes, [1441, 1442]);
	assert.equal(record.execution, "local"); assert.equal(record.revision, finPythonRubyRevision);
	assert.deepEqual(record.scope, { profiles: ["python", "ruby"]
		, sourcePaths: ["ordinary-source", "reviewed-ir"]
		, families: ["product", "product-array", "record"]
		, dispatchObserved: false, hostedCi: false, binaryArchivesRetained: false });
	assert.deepEqual(record.producerEnvironment, { nodeVersion: "v22.23.2"
		, nodeVersionSource: "runner process.version"
		, declaredHostGlibcVersion: "2.36", hostGlibcVersionMeasured: false
		, nativeGlibcFloor: "2.36"
		, cpu: 3, concurrency: 1, minimumFreeMiB: 2048
		, configuredLeanToolchain: "leanprover/lean4:v4.32.2"
		, leanVersionMeasured: false
		, leanThreads: 1, ompThreads: 1, makeJobs: 1 });
	assert.equal(Object.hasOwn(record.producerEnvironment, "hostGlibcVersion"), false);
	assert.equal(Object.hasOwn(record.producerEnvironment, "leanToolchain"), false);
	assert.equal(record.priorReceipt.path, `${finPythonRubyDirectory}/receipt.json`);
	assert.equal(record.priorReceipt.sha256, "af9106519066576db0d8806b369d011d4bb1150c2fe9051ba44d1fc8eba88e3e");
	const previous = await readFile(record.priorReceipt.path);
	assert.equal(sha256(previous), record.priorReceipt.sha256);
	for(const key of ["artifacts", "sourceFiles", "runs", "scope", "revision"])
		assert.deepEqual(record[key], JSON.parse(previous)[key], key);
	assert.match(record.sourceIdentityScope, /not a complete dependency closure/u);
	assert.deepEqual(record.sourceFiles.map(file => file.path), finPythonRubySourcePaths);
	for(const source of record.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256)), source.sha256, source.path);
	assert.deepEqual(record.runs.map(run => run.id), finPythonRubyRuntimes.flatMap(runtime => finPythonRubySteps.map(step => `${runtime.id}-${step.id}`)));
	assert.equal(record.artifacts.length, 27);
	assert.equal(new Set(record.artifacts.map(file => file.path)).size, 27);
	const expectedArtifacts = [];
	for(const runtime of finPythonRubyRuntimes)
	{
		const execution = record.runtimes.find(item => item.id === runtime.id);
		for(const kind of ["tap", "queue", "runner"]) expectedArtifacts.push(execution[kind]);
		for(const [index, step] of finPythonRubySteps.entries())
		{
			const run = record.runs.find(item => item.id === `${runtime.id}-${step.id}`);
			assert.equal(run.runtime, runtime.id); assert.equal(run.profile, runtime.profile);
			assert.equal(run.family, step.family); assert.equal(run.route, step.route);
			assert.equal(run.report.path, `${finPythonRubyDirectory}/${run.id}.json`);
			assert.equal(run.report.originalPath, `build/vo1441-${run.id}-72c5e27.json`);
			assert.equal(run.report.sha256, runtime.reports[index]);
			await assertFinPythonRubyReport(JSON.parse(await readOriginal(run.report)), run);
			expectedArtifacts.push(run.report);
		}
	}
	assert.deepEqual(record.artifacts, expectedArtifacts);
});

test("each Python floor and Ruby version retains its actual interpreter log and original runner", async () => {
	const record = await receipt();
	assert.deepEqual(record.runtimes.map(item => item.id), finPythonRubyRuntimes.map(item => item.id));
	for(const runtime of finPythonRubyRuntimes)
	{
		const execution = record.runtimes.find(item => item.id === runtime.id);
		assert.equal(execution.version, runtime.version); assert.equal(execution.profile, runtime.profile);
		assert.equal(execution.versionSource, "runner invoked the configured interpreter with --version before the selections; the installer used that executable");
		assert.equal(execution.versionPrintedByConsumer, false);
		for(const kind of ["tap", "queue", "runner"])
		{
			assert.equal(execution[kind].sha256, runtime[kind]);
			assert.equal(execution[kind].path, `${finPythonRubyDirectory}/${runtime.id}.${kind === "runner" ? "runner.mjs.txt" : kind}`);
		}
		const queue = (await readOriginal(execution.queue)).toString(), tap = (await readOriginal(execution.tap)).toString();
		assertFinPythonRubyExecution(runtime, queue, tap);
		const runner = (await readOriginal(execution.runner)).toString();
		assert.ok(runner.includes(`const revision = "${finPythonRubyRevision}"`));
		assert.ok(runner.includes(`LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"`));
		assert.ok(runner.includes(`!key.startsWith("LEAN_BRIDGE_")`));
		assert.ok(runner.includes(`assert.ok(free >= 2048`));
		assert.ok(runner.includes(`assert.equal(code, 0`));
		assert.ok(runner.includes(runtime.profile === "python" ? `/app/.toolchains/${runtime.id}/bin/python3` : "/app/.toolchains/ruby33/bin/ruby"));
	}
	for(const step of finPythonRubySteps)
		assert.equal(record.runs.find(run => run.id === `python311-${step.id}`).report.sha256, record.runs.find(run => run.id === `python312-${step.id}`).report.sha256);
	assert.notEqual(record.runtimes[0].queue.sha256, record.runtimes[1].queue.sha256);
	assert.notEqual(record.runtimes[0].tap.sha256, record.runtimes[1].tap.sha256);
});

test("Python/Ruby archive validation refuses wrong bounds, identities, isolation and invented observations", async () => {
	const record = await receipt();
	const mutations = [
		["zero checks", report => { report.reports[0].checks = 0; }]
		, ["wrong count", report => { report.reports[0].checks++; }]
		, ["wrong host", report => { report.reports[0].profile = "cpp"; }]
		, ["wrong route", report => { report.reports[0].path = "other-route"; }]
		, ["missing export", report => { delete report.reports[0].refinements[Object.keys(report.reports[0].refinements)[0]]; }]
		, ["erased bounds", report => { report.reports[0].refinements = {}; }]
		, ["changed bound", report => { report.reports[0].refinements = JSON.parse(JSON.stringify(report.reports[0].refinements).replace(/"bound":"\d+"/u, '"bound":"987654321"')); }]
		, ["no reproduction", report => { report.reproducible = false; }]
		, ...["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"].map(flag => [flag, report => { report.reports[0][flag] = false; }])
		, ...["consumerSha256", "modelSha256", "bindingIrSha256", "sourceTreeSha256", "receiptSha256"].map(key => [key, report => { report.reports[0][key] = "f".repeat(64); }])
		, ["invented dispatch", report => { report.reports[0].dispatch = { observed: true }; }]
		, ["top-level dispatch", report => { report.dispatch = {}; }]
		, ["missing profile", report => { report.reports = []; }]
		, ["duplicated profile", report => { report.reports.push(structuredClone(report.reports[0])); }]
		, ["extra archive", report => { report.archives["archives/extra.gem"] = "a".repeat(64); }]
		, ["archive mismatch", report => { report.archives[Object.keys(report.archives)[0]] = "a".repeat(64); }]
		, ["wrong package floor", report => { report.reports[0].packages[0].artifacts[0].path = "archives/wrong-floor.whl"; }]
		, ["wrong artifact size", report => { report.reports[0].packages[0].artifacts[0].bytes++; }]
		, ["wrong runtime bytes", report => { report.reports[0].packages[0].runtimeIdentity = "a".repeat(64); }]
		, ["invented or wrong review", report => { report.reports[0].reviewedSourceSha256 = "a".repeat(64); }]
	];
	for(const run of record.runs)
	{
		const original = JSON.parse(await readOriginal(run.report));
		for(const [label, edit] of mutations)
		{
			const changed = structuredClone(original); edit(changed);
			await assert.rejects(() => assertFinPythonRubyReport(changed, run), assert.AssertionError, `${run.id}: ${label}`);
		}
	}
});

test("execution checks reject swapped floors, missing steps, skipped tests and a failed producer", async () => {
	const record = await receipt(), runtime = finPythonRubyRuntimes[0], execution = record.runtimes[0];
	const queue = (await readOriginal(execution.queue)).toString(), tap = (await readOriginal(execution.tap)).toString();
	const changes = [
		["wrong Python", queue.replace("Python 3.11.16", "Python 3.12.14"), tap]
		, ["wrong producer", queue.replace(finPythonRubyRevision, "a".repeat(40)), tap]
		, ["wrong Node", queue.replace("v22.23.2", "v22.23.3"), tap]
		, ["missing sequence", queue.split("\n").filter(line => !line.startsWith("report record-reviewed")).join("\n"), tap]
		, ["mismatched hash", queue.replace(runtime.reports[0], "a".repeat(64)), tap]
		, ["missing completion", queue.replace(/^all steps passed .+$/mu, ""), tap]
		, ["failed step", queue.replace("exit=0", "exit=1"), tap]
		, ["skipped test", queue, tap.replace("# skipped 0", "# skipped 1")]
		, ["cancelled test", queue, tap.replace("# cancelled 0", "# cancelled 1")]
		, ["contradictory summary", queue, tap.replace("# fail 0", "# fail 0\n# fail 1")]
		, ["wrong selection", queue, tap.replace("# step product-reviewed", "# step product-ordinary")]
		, ["wrong consumer", queue, tap.replace("# installing and checking python", "# installing and checking ruby")]
		, ["wrong exit", queue, tap.replace("exit=0", "exit=1")]
	];
	for(const [label, changedQueue, changedTap] of changes)
		assert.throws(() => assertFinPythonRubyExecution(runtime, changedQueue, changedTap), assert.AssertionError, label);
});
