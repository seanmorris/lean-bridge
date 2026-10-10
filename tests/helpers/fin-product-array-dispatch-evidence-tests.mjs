/**
 * Preserve installed Array-of-product results and the measured C dispatch controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { finProductArrayRefinements } from "./fin-product-array-install.mjs";
import { finProductArrayDispatchColumns, finProductArrayDispatchExpected } from "./fin-product-array-dispatch.mjs";
import { finProductArrayReviewedIr } from "./reviewed-fin-product-array-fixture.mjs";

const directory = "docs/evidence/native-fin-product-array-dispatch-20261007";
const identities = [
	["ordinary-c-cpp", "ordinary-source", "ea9e0facca587bf3fccc2f325cf6267b6c0dbb048a6c9e0475eeae1bc38431bd", "57d1b716f2616a05ee6e15bd139ef247956470da0a5aa4a76b5ee05af2236cdb", 11, 2]
	, ["reviewed-c-cpp", "reviewed-ir", "23a6bda6a9e647f6b1f467237964faab1a06a9c0ee5dd2125b122891ca5d736b", "bb14da42548da66509203bfecb4e0c8f7d741225c72546a09f187d4640d096eb", 16, 1]];

const validateReport = (report, path) => {
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
	assert.equal(Object.keys(report.archives).length, 2);
	for(const item of report.reports)
	{
		assert.equal(item.path, path);
		assert.equal(item.checks, item.profile === "c" ? 2015 : 2010);
		assert.deepEqual(item.refinements, finProductArrayRefinements);
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
		if(path === "reviewed-ir") assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(finProductArrayReviewedIr())));
		else assert.equal(Object.hasOwn(item, "reviewedSourceSha256"), false);
		if(item.profile === "c")
		{
			assert.deepEqual(item.dispatch.columns, finProductArrayDispatchColumns);
			assert.deepEqual(item.dispatch.observed, finProductArrayDispatchExpected);
			assert.equal(item.dispatch.interposer, "LD_PRELOAD");
			assert.equal(item.dispatch.positiveControl, "valid public and raw calls increment source and adapter counts");
		}
		else assert.equal(Object.hasOwn(item, "dispatch"), false, "The C++ consumer does not independently measure dispatch");
	}
};

test("Array dispatch archives retain exact installed packages and ten measured C rows", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.planNode, 1441);
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
	for(const source of receipt.sourceFiles) assert.equal(sha256(beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256)), source.sha256, source.path);
	assert.deepEqual(receipt.runs.map(run => run.id), identities.map(([id]) => id));
	for(const [id, path, reportDigest, logDigest, passed, skipped] of identities)
	{
		const run = receipt.runs.find(item => item.id === id);
		assert.equal(run.sourcePath, path);
		assert.equal(run.report.path, `${directory}/${id}.json`);
		assert.equal(run.report.sha256, reportDigest);
		assert.match(run.reproduceCommand, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36/u);
		assert.match(run.reproduceCommand, /taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap tests\/native-fin-product-arrays\.test\.mjs$/u);
		const bytes = await readFile(run.report.path);
		assert.equal(sha256(bytes), reportDigest);
		const report = JSON.parse(bytes);
		validateReport(report, path);
		for(const item of report.reports)
		{
			const consumer = `tests/fixtures/fin-product-array-consumers/${item.profile}.${item.profile === "c" ? "c" : "cpp"}`;
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
		if(path === "reviewed-ir") for(const [index, label] of ["tightened component", "loosened error branch", "bound moved to the ok branch", "dropped result bound"].entries())
			assert.ok(log.includes(`ok ${index + 1} - ${label}\n`), label);
	}
});

test("Array dispatch evidence refuses missing positions, false counters and inherited C++ dispatch", async () => {
	const original = JSON.parse(await readFile(`${directory}/reviewed-c-cpp.json`, "utf8"));
	for(const change of [
		report => { delete report.reports[0].refinements["FinProductArrays.rows"]; }
		, report => { report.reports[0].dispatch.observed[9][2][0] = 2; }
		, report => { report.reports[0].dispatch.observed[2][2][0] = 2; }
		, report => { report.reports[1].dispatch = report.reports[0].dispatch; }
		, report => { report.reports[0].checks = 2000; }
		, report => { report.reproducible = false; }
		, report => { report.reports[0].sourceRemovedBeforeInstallation = false; }
		, report => { report.reports[0].reviewedSourceSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); change(changed);
		assert.throws(() => validateReport(changed, "reviewed-ir"));
	}
});
