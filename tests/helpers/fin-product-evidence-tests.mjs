/**
 * Authenticate the initial ordinary and reviewed C/C++ product executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { finProductRefinements } from "./fin-product-install.mjs";
import { finProductDispatchColumns, finProductDispatchExpected } from "./fin-product-dispatch.mjs";
import { finProductReviewedIr } from "./reviewed-fin-product-fixture.mjs";
import "./fin-product-array-evidence-tests.mjs";

const directory = "docs/evidence/native-fin-products-20261007";
const identities = [
	["ordinary-c-cpp", "ordinary-source"
		, "92e4e933606fe3afcd12c388430303a83b6626a5"
		, "62ffaf34d8466c1b3bb3afd963f1cab5955fb60640c06649308edcc28e2afcdf"]
	, ["reviewed-c-cpp", "reviewed-ir"
		, "fbdd44bf4cec74ea7b2cd0e21ec5a84657f1a75c"
		, "714b72fd99614290cc3fe12f3b57411b0ead08d4679e6ba6fd1fe3286e79e14f"]];

test("C/C++ product archives bind both source paths to exact bounds and measured dispatch", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.planNode, 1441);
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.producerEnvironment.platform, "Debian 12");
	assert.equal(receipt.producerEnvironment.hostGlibcVersion, "2.36");
	assert.equal(receipt.producerEnvironment.overrides.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, null);
	assert.deepEqual(receipt.reports.map(report => report.id), identities.map(([id]) => id));
	for(const [id, path, revision, digest] of identities)
	{
		const reference = receipt.reports.find(report => report.id === id);
		assert.equal(reference.revision, revision);
		assert.equal(reference.sha256, digest);
		assert.equal(reference.path, `${directory}/${id}.json`);
		assert.equal(reference.sourcePath, path);
		assert.deepEqual(reference.profiles, ["c", "cpp"]);
		assert.ok(reference.reproduceCommand.includes("node --test --test-concurrency=1 --test-reporter=tap tests/native-fin-products.test.mjs"));
		assert.ok(!reference.reproduceCommand.includes("LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR"));
		const bytes = await readFile(reference.path);
		assert.equal(sha256(bytes), digest);
		const report = JSON.parse(bytes);
		assert.equal(report.schemaVersion, 1);
		assert.equal(report.reproducible, true);
		assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
		assert.equal(Object.keys(report.archives).length, 2);
		for(const item of report.reports)
		{
			assert.equal(item.path, path);
			assert.equal(item.checks, item.profile === "c" ? 2038 : 2039);
			assert.deepEqual(item.refinements, finProductRefinements);
			const source = await readFile(`tests/fixtures/fin-product-consumers/${item.profile}.${item.profile === "c" ? "c" : "cpp"}`);
			assert.equal(item.consumerSha256, sha256(source));
			for(const flag of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"])
				assert.equal(item[flag], true, flag);
			for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"])
				assert.match(item[key], /^[a-f0-9]{64}$/u, key);
			for(const pkg of item.packages) for(const artifact of pkg.artifacts)
			{
				assert.equal(report.archives[artifact.path], artifact.sha256);
				assert.ok(artifact.bytes > 0);
			}
			if(path === "reviewed-ir")
				assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(finProductReviewedIr())));
			else assert.equal(Object.hasOwn(item, "reviewedSourceSha256"), false);
			if(item.profile === "c")
			{
				assert.equal(item.dispatch.interposer, "LD_PRELOAD");
				assert.deepEqual(item.dispatch.columns, finProductDispatchColumns);
				assert.deepEqual(item.dispatch.observed, finProductDispatchExpected);
			}
			else assert.equal(Object.hasOwn(item, "dispatch"), false, "C++ does not inherit C's measured dispatch");
		}
		const [c, cpp] = report.reports;
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"])
			assert.equal(c[key], cpp[key], key);
	}
});

test("product logs retain the failed baseline review and the corrected run with four mismatches", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.logs.length, 2);
	const logDigests = [
		"8cfc1db1afae592d9c2e28d771e86dab95edac4e1f8862563a97655375438e0e"
		, "009570ae286053a4b6cc454bd6caf5653470e8aad1733a1a904f201f298bc090"];
	for(const [index, digest] of logDigests.entries())
	{
		const reference = receipt.logs[index];
		assert.equal(reference.sha256, digest);
		assert.equal(reference.revision, identities[index][2]);
		const source = await readFile(reference.path, "utf8");
		assert.equal(sha256(source), digest);
		assert.match(source, /^# tests 18$/mu);
		assert.match(source, /^# pass 17$/mu);
		assert.match(source, index === 0 ? /^# fail 1$/mu : /^# fail 0$/mu);
		assert.match(source, index === 0 ? /^# skipped 0$/mu : /^# skipped 1$/mu);
		if(index === 0)
		{
			assert.match(source, /not ok 13 - independently reviewed native packages/u);
			assert.match(source, /"field":"bindingIr.types.length"/u);
			assert.match(source, /code: 'reviewed-ir-source-mismatch'/u);
		}
		else assert.doesNotMatch(source, /^not ok /mu);
		for(const label of ["tightened component", "loosened branch", "swapped branches", "moved to the other component"])
			assert.ok(source.includes(label), label);
		assert.ok(source.includes("ok 14 - the independent product review passes reviewed admission, and changed bounds are refused against fresh Lean"));
	}
});
