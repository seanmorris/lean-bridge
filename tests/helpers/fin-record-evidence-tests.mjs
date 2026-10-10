/**
 * Preserve installed record-field results and the measured C dispatch controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { finRecordRefinements } from "./fin-record-install.mjs";
import { finRecordDispatchColumns, finRecordDispatchExpected } from "./fin-record-dispatch.mjs";
import { finRecordReviewedIr } from "./reviewed-fin-record-fixture.mjs";

const directory = "docs/evidence/native-fin-records-20261007";
const identities = [
	["ordinary-c-cpp", "ordinary-source", "764b93f59c5658bab93d0a35832b3c2545cefe1f6a3ed04628549e1508e0d168", "01704d12e40e4bb66ac69a85dca773278e294c610b840b1bd933f6a5c1ca3423", 12, 2]
	, ["reviewed-c-cpp", "reviewed-ir", "b397a2125bb2bc63d8f949eda8130488ba5a9bf4499728a6b10e3ab07ceb8716", "7e462f0933b14e4b477a6eef6842a31131c9d58aa7b6b4d315c6f138e7f33daf", 18, 1]];

const validateReport = (report, path) => {
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
	assert.equal(Object.keys(report.archives).length, 2);
	for(const item of report.reports)
	{
		assert.equal(item.path, path);
		assert.equal(item.checks, item.profile === "c" ? 2064 : 2053);
		assert.deepEqual(item.refinements, finRecordRefinements);
		for(const flag of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"])
			assert.equal(item[flag], true, flag);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"])
			assert.match(item[key], /^[a-f0-9]{64}$/u);
		assert.equal(item.packages.length, 1);
		for(const pkg of item.packages) for(const artifact of pkg.artifacts)
		{
			assert.equal(report.archives[artifact.path], artifact.sha256);
			assert.ok(artifact.bytes > 0);
		}
		if(path === "reviewed-ir") assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(finRecordReviewedIr())));
		else assert.equal(Object.hasOwn(item, "reviewedSourceSha256"), false);
		if(item.profile === "c")
		{
			assert.deepEqual(item.dispatch.columns, finRecordDispatchColumns);
			assert.deepEqual(item.dispatch.observed, finRecordDispatchExpected);
			assert.equal(item.dispatch.interposer, "LD_PRELOAD");
			assert.equal(item.dispatch.positiveControl, "valid public and raw calls increment source and adapter counts");
		}
		else assert.equal(Object.hasOwn(item, "dispatch"), false, "The C++ consumer does not independently measure dispatch");
	}
};

test("record archives bind the expanded frozen fixture, original packages and C dispatch", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.planNode, 1442);
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.revision, "3ece09f611054538c71d5104acc46f2eb3e1a4d7");
	assert.equal(receipt.producerEnvironment.hostGlibcVersion, "2.36");
	assert.deepEqual(receipt.producerEnvironment.overrides, {
		LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: null
		, LEAN_BRIDGE_LAKE_ENGINE: null
	});
	assert.deepEqual(receipt.scope.profiles, ["c", "cpp"]);
	assert.deepEqual(receipt.scope.sourcePaths, ["ordinary-source", "reviewed-ir"]);
	assert.deepEqual(receipt.scope.dispatchProfiles, ["c"]);
	assert.deepEqual(receipt.scope.unmeasuredDispatchProfiles, ["cpp"]);
	assert.equal(receipt.sourceFiles.length, 6);
	for(const source of receipt.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256)), source.sha256, source.path);
	assert.deepEqual(receipt.runs.map(run => run.id), identities.map(([id]) => id));
	for(const [id, path, reportDigest, logDigest, passed, skipped] of identities)
	{
		const run = receipt.runs.find(item => item.id === id);
		assert.equal(run.sourcePath, path);
		assert.equal(run.report.path, `${directory}/${id}.json`);
		assert.equal(run.report.sha256, reportDigest);
		assert.match(run.reproduceCommand, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36/u);
		assert.match(run.reproduceCommand, /taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap tests\/native-fin-records\.test\.mjs$/u);
		const bytes = await readFile(run.report.path);
		assert.equal(sha256(bytes), reportDigest);
		const report = JSON.parse(bytes);
		validateReport(report, path);
		for(const item of report.reports)
		{
			const consumer = `tests/fixtures/fin-record-consumers/${item.profile}.${item.profile === "c" ? "c" : "cpp"}`;
			assert.equal(sha256(beforeFinRefinementSource(consumer, await readFile(consumer), item.consumerSha256)), item.consumerSha256);
		}
		assert.equal(run.log.path, `${directory}/${id}.tap`);
		assert.equal(run.log.sha256, logDigest);
		assert.equal(run.log.passed, passed); assert.equal(run.log.failed, 0); assert.equal(run.log.skipped, skipped);
		const log = await readFile(run.log.path, "utf8");
		assert.equal(sha256(log), logDigest);
		assert.ok(log.includes(`# pass ${passed}\n`));
		assert.ok(log.includes(`# skipped ${skipped}\n`));
		assert.match(log, /^# fail 0$/mu); assert.match(log, /^exit=0$/mu);
		assert.doesNotMatch(log, /^not ok /mu);
		if(path === "reviewed-ir") for(const [index, label] of ["tightened field", "bound moved to the other field", "loosened nested record's own bound", "tightened case field", "loosened Fin 0 case"].entries())
			assert.ok(log.includes(`ok ${index + 1} - ${label}\n`), label);
	}
});

test("record evidence refuses lost compositions, false counters and inherited C++ dispatch", async () => {
	const original = JSON.parse(await readFile(`${directory}/reviewed-c-cpp.json`, "utf8"));
	for(const change of [
		report => { delete report.reports[0].refinements["FinRecords.tileExcept"]; }
		, report => { report.reports[0].dispatch.observed[7][2][0] = 1; }
		, report => { report.reports[0].dispatch.observed[2][2][0] = 2; }
		, report => { report.reports[1].dispatch = report.reports[0].dispatch; }
		, report => { report.reports[0].checks = 2050; }
		, report => { report.reproducible = false; }
		, report => { report.reports[0].sourceRemovedBeforeInstallation = false; }
		, report => { report.reports[0].reviewedSourceSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); change(changed);
		assert.throws(() => validateReport(changed, "reviewed-ir"));
	}
});
