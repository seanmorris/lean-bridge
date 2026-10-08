/**
 * Authenticate the WIT record archive and discriminate against false acceptance claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import "./fin-wit-archive-source-history-tests.mjs";
import { assertFinWitRecordExecution, assertFinWitRecordReport, finWitRecordArtifacts, finWitRecordDirectory, finWitRecordEnvironment, finWitRecordRevision, finWitRecordRuns, finWitRecordScope, finWitRecordSourcePaths } from "./fin-wit-record-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${finWitRecordDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "d4a42fa144f5432cf731f5a3b81ea0dc9514c6464955b18d7bc8ba6287974779");
	return JSON.parse(bytes);
};
const readOriginal = async reference => {
	const bytes = await readFile(reference.path);
	assert.equal(bytes.length, reference.bytes); assert.equal(sha256(bytes), reference.sha256, reference.path);
	return bytes;
};
const originalSources = async record => {
	const sources = new Map();
	for(const source of record.sourceFiles)
	{
		const bytes = beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256);
		assert.equal(sha256(bytes), source.sha256, source.path); sources.set(source.path, bytes);
	}
	return async path => { assert.ok(sources.has(path), path); return sources.get(path); };
};
const artifact = (record, name) => record.artifacts.find(item => item.path === `${finWitRecordDirectory}/${name}`);

test("WIT record evidence authenticates both source routes, exact fixture trees and seven original artifacts", async () => {
	const record = await receipt();
	assert.equal(record.schemaVersion, 1); assert.deepEqual(record.planNodes, [1442, 1448]);
	assert.equal(record.execution, "local"); assert.equal(record.revision, finWitRecordRevision);
	assert.deepEqual(record.scope, finWitRecordScope); assert.deepEqual(record.producerEnvironment, finWitRecordEnvironment);
	assert.match(record.sourceIdentityScope, /not a complete dependency closure/u);
	assert.deepEqual(record.sourceFiles.map(item => item.path), finWitRecordSourcePaths);
	const readSource = await originalSources(record);
	assert.equal(record.artifacts.length, finWitRecordArtifacts.length);
	for(const [index, expected] of finWitRecordArtifacts.entries())
	{
		const item = record.artifacts[index];
		assert.equal(item.path, `${finWitRecordDirectory}/${expected.name}`);
		assert.equal(item.originalPath, expected.originalPath); assert.equal(item.sha256, expected.sha256);
		await readOriginal(item);
	}
	assert.deepEqual(record.runs.map(run => run.id), finWitRecordRuns.map(run => run.id));
	for(const run of record.runs)
	{
		assert.deepEqual(run.report, artifact(record, `${run.id}.json`));
		await assertFinWitRecordReport(JSON.parse(await readOriginal(run.report)), run, readSource);
	}
});

test("WIT record execution retains measured tools and separates failed hosted acceptance", async () => {
	const record = await receipt();
	const queue = (await readOriginal(artifact(record, "execution.queue"))).toString();
	const tap = (await readOriginal(artifact(record, "execution.tap"))).toString();
	assertFinWitRecordExecution(queue, tap);
	const runner = (await readOriginal(artifact(record, "execution.runner.mjs.txt"))).toString();
	for(const fragment of [`revision="${finWitRecordRevision}"`
		, `git(["status","--porcelain","--untracked-files=no"])`
		, `!key.startsWith("LEAN_BRIDGE_")`
		, `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:"2.36"`
		, "free>=2048"
		, `assert.equal(code,0`
		, `"--test-concurrency=1"`
		, `"tests/native-fin-records.test.mjs"`
		, `version("/usr/bin/getconf",["GNU_LIBC_VERSION"])`
		, `version(lean+"/bin/lean",["--version"])`
		, `version(wasmTools,["--version"])`
		, `sha(await readFile(wasmtime+"/lib/libwasmtime.so"))`])
		assert.ok(runner.includes(fragment), fragment);
	assert.equal(record.producerEnvironment.wasmtimeVersionMeasured, false);
	assert.equal(record.producerEnvironment.versionsPrintedByConsumer, false);
	assert.match(record.scope.compilerFreePathMeaning, /system C compiler/u);
	const failure = record.priorFailures.hosted;
	assert.equal(failure.artifact, "hosted-f9d5ce9-failure.log"); assert.equal(failure.outcome, "failure");
	assert.equal(failure.revision, "f9d5ce96eb04ec800209c6a6863092b3bdea6e85");
	assert.equal(failure.runId, 37736101772); assert.equal(failure.jobId, 113176414728);
	assert.notEqual(failure.revision, record.revision);
	const hosted = (await readOriginal(artifact(record, failure.artifact))).toString();
	assert.ok(hosted.includes(failure.revision));
	for(const run of finWitRecordRuns)
	{
		const title = run.title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
		assert.match(hosted, new RegExp(`^\\S+ not ok \\d+ - ${title}$`, "mu"), run.id);
	}
	const baseline = (await readOriginal(artifact(record, record.priorFailures.local.artifact))).toString();
	assert.equal(record.priorFailures.local.outcome, "failure");
	assert.match(baseline, /compact patterns all pass; canonical matches: false,false,false/u);
	assert.match(baseline, /AssertionError/u);
});

test("WIT record report checks reject changed bounds, provenance, isolation and invented dispatch", async () => {
	const record = await receipt(), readSource = await originalSources(record);
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
		, ["missing selection", report => { report.reports = []; }]
		, ["duplicated selection", report => { report.reports.push(structuredClone(report.reports[0])); }]
		, ["extra archive", report => { report.archives["archives/extra.tar.gz"] = "a".repeat(64); }]
		, ["archive mismatch", report => { report.archives[Object.keys(report.archives)[0]] = "a".repeat(64); }]
		, ["wrong archive path", report => { report.reports[0].packages[0].artifacts[0].path = "archives/wrong-floor.tar.gz"; }]
		, ["wrong artifact size", report => { report.reports[0].packages[0].artifacts[0].bytes++; }]
		, ["wrong runtime", report => { report.reports[0].packages[0].runtimeIdentity = "a".repeat(64); }]
		, ["wrong review", report => { report.reports[0].reviewedSourceSha256 = "a".repeat(64); }]
	];
	for(const run of record.runs)
	{
		const original = JSON.parse(await readOriginal(run.report));
		for(const [label, edit] of mutations)
		{
			const changed = structuredClone(original); edit(changed); assert.notDeepEqual(changed, original, label);
			await assert.rejects(() => assertFinWitRecordReport(changed, run, readSource), assert.AssertionError, `${run.id}: ${label}`);
		}
		const changedFixture = structuredClone(run); changedFixture.fixture.inputs[0].sha256 = "f".repeat(64);
		await assert.rejects(() => assertFinWitRecordReport(original, changedFixture, readSource), assert.AssertionError);
		await assert.rejects(() => assertFinWitRecordReport(original, run, async path => Buffer.concat([await readSource(path), Buffer.from("\n")])), assert.AssertionError);
	}
});

test("WIT execution validation rejects missing, skipped, cancelled or misidentified runs", async () => {
	const record = await receipt();
	const queue = (await readOriginal(artifact(record, "execution.queue"))).toString();
	const tap = (await readOriginal(artifact(record, "execution.tap"))).toString();
	const changes = [
		["wrong producer", queue.replace(finWitRecordRevision, "a".repeat(40)), tap]
		, ["wrong Node", queue.replace("v22.23.2", "v22.23.3"), tap]
		, ["wrong Lean", queue.replace("version 4.32.2", "version 4.31.0"), tap]
		, ["wrong wasm-tools", queue.replace("1.245.1", "1.244.0"), tap]
		, ["wrong runtime library", queue.replace(finWitRecordEnvironment.wasmtimeLibrarySha256, "a".repeat(64)), tap]
		, ["wrong glibc", queue.replace("glibc 2.36", "glibc 2.38"), tap]
		, ["wrong floor", queue.replace("declaredGlibcFloor=2.36", "declaredGlibcFloor=2.38"), tap]
		, ["insufficient space", queue.replace("freeMiB=3469", "freeMiB=1024"), tap]
		, ["missing selection", queue.split("\n").filter(line => !line.startsWith("report reviewed")).join("\n"), tap]
		, ["mismatched hash", queue.replace(finWitRecordRuns[0].reportSha256, "a".repeat(64)), tap]
		, ["missing completion", queue.replace(/^all steps passed .+$/mu, ""), tap]
		, ["failed step", queue.replace("exit=0", "exit=1"), tap]
		, ["invalid chronology", queue.replace("2026-10-08T10:26:00.202Z", "2026-10-08T09:26:00.202Z"), tap]
		, ["skipped test", queue, tap.replace("# skipped 0", "# skipped 1")]
		, ["cancelled test", queue, tap.replace("# cancelled 0", "# cancelled 1")]
		, ["contradictory summary", queue, tap.replace("# fail 0", "# fail 0\n# fail 1")]
		, ["wrong selection", queue, tap.replace("# step reviewed", "# step ordinary")]
		, ["wrong consumer", queue, tap.replace("# installing and checking wit-wasi", "# installing and checking cpp")]
		, ["wrong exit", queue, tap.replace("exit=0", "exit=1")]
	];
	for(const [label, changedQueue, changedTap] of changes)
	{
		assert.notDeepEqual([changedQueue, changedTap], [queue, tap], label);
		assert.throws(() => assertFinWitRecordExecution(changedQueue, changedTap), assert.AssertionError, label);
	}
});
