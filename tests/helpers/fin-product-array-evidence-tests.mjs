/**
 * Authenticate local Array-of-product executions without inventing dispatch observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./fin-product-array-dispatch-evidence-tests.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { finProductArrayRefinements } from "./fin-product-array-install.mjs";
import { finProductArrayReviewedIr } from "./reviewed-fin-product-array-fixture.mjs";

const directory = "docs/evidence/native-fin-product-arrays-20261007";
const identities = [
	["ordinary-c-cpp", "ordinary-source", "4d8f8a6f89a27472b4ba6c800838e52bae3e8737ef733e923dc5354408f2c969", "0d7575f8864a4c834463550a6a8f8a6ddf3398c3b13a4d3bd2317e49ce1b72c4", 11, 2]
	, ["reviewed-c-cpp", "reviewed-ir", "544a70f13b725572d452b4528f57cbfc775cc6947a74296bb7196bcaa4c01f52", "e300c12447c46589f6379983f6b4cf80b022506b7cfe2ef7e395cf0970091599", 16, 1]];

test("Array product archives retain exact installed C/C++ results and unmeasured dispatch", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.planNode, 1441);
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.revision, "faac75b2b5ad0df25536c3e776ab1176e8731aed");
	assert.equal(receipt.producerEnvironment.hostGlibcVersion, "2.36");
	assert.deepEqual(receipt.producerEnvironment.overrides, {
		LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: null
		, LEAN_BRIDGE_LAKE_ENGINE: null
	});
	assert.equal(receipt.scope.sourceDispatchObserved, false);
	assert.equal(receipt.scope.rawAdapterDispatchObserved, false);
	assert.deepEqual(receipt.runs.map(run => run.id), identities.map(([id]) => id));
	for(const [id, path, reportDigest, logDigest, passed, skipped] of identities)
	{
		const run = receipt.runs.find(item => item.id === id);
		assert.equal(run.sourcePath, path);
		assert.equal(run.report.path, `${directory}/${id}.json`);
		assert.equal(run.report.sha256, reportDigest);
		assert.match(run.command, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36/u);
		const bytes = await readFile(run.report.path);
		assert.equal(sha256(bytes), reportDigest);
		const report = JSON.parse(bytes);
		assert.equal(report.reproducible, true);
		assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
		assert.equal(Object.keys(report.archives).length, 2);
		for(const item of report.reports)
		{
			assert.equal(item.path, path);
			assert.equal(item.checks, item.profile === "c" ? 2015 : 2010);
			assert.deepEqual(item.refinements, finProductArrayRefinements);
			const consumer = `tests/fixtures/fin-product-array-consumers/${item.profile}.${item.profile === "c" ? "c" : "cpp"}`;
			assert.equal(sha256(beforeFinRefinementSource(consumer, await readFile(consumer), item.consumerSha256)), item.consumerSha256);
			for(const flag of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"])
				assert.equal(item[flag], true, flag);
			assert.equal(Object.hasOwn(item, "dispatch"), false, "These historical reports do not measure dispatch");
			for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"])
				assert.match(item[key], /^[a-f0-9]{64}$/u);
			for(const pkg of item.packages) for(const artifact of pkg.artifacts)
			{
				assert.equal(report.archives[artifact.path], artifact.sha256);
				assert.ok(artifact.bytes > 0);
			}
			if(path === "reviewed-ir") assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(finProductArrayReviewedIr())));
			else assert.equal(Object.hasOwn(item, "reviewedSourceSha256"), false);
		}
		assert.equal(run.log.sha256, logDigest);
		const log = await readFile(run.log.path, "utf8");
		assert.equal(sha256(log), logDigest);
		assert.ok(log.includes(`# pass ${passed}\n`));
		assert.ok(log.includes(`# skipped ${skipped}\n`));
		assert.match(log, /^# fail 0$/mu);
		assert.match(log, /^exit=0$/mu);
		assert.doesNotMatch(log, /^not ok /mu);
		if(path === "reviewed-ir") for(const label of ["tightened component", "loosened error branch", "bound moved to the ok branch", "dropped result bound"])
			assert.ok(log.includes(label), label);
	}
});

test("the product follow-up preserves all five fresh-Lean refusal results", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	const reference = receipt.productReviewFollowup.log;
	const digest = "2e36482004fef311e9d3b839f764e1eca32ca2b408a970ef5ab143cd79bf8907";
	assert.equal(reference.sha256, digest);
	const log = await readFile(reference.path, "utf8");
	assert.equal(sha256(log), digest);
	assert.match(log, /^# pass 6$/mu);
	assert.match(log, /^# fail 0$/mu);
	assert.match(log, /^# skipped 0$/mu);
	assert.match(log, /^exit=0$/mu);
	for(const [index, label] of ["tightened component", "loosened branch", "swapped branches", "moved to the other component", "tightened alias component"].entries())
		assert.ok(log.includes(`ok ${index + 1} - ${label}\n`), label);
});
