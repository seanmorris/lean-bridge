/** @file */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { registerRetainedContractTests, retainedContractScope } from "./helpers/retained-contract-tests.mjs";

const workflowJob = (source, job) => source.split(`\n  ${job}:\n`)[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];

test("retained contracts are required by default and reject an unknown policy", async () => {
	assert.equal(retainedContractScope({}), "required");
	assert.throws(() => retainedContractScope({ LEAN_BRIDGE_RETAINED_CONTRACTS: "optional" })
		, /must be one of: required, deferred/u);
	await assert.rejects(registerRetainedContractTests([null], {}), /loaders must be functions/u);
});

test("required retained contracts load every suite in order", async () => {
	const loaded = [];
	const result = await registerRetainedContractTests([
		async () => { loaded.push("history"); }
		, async () => { loaded.push("evidence"); }
	], { LEAN_BRIDGE_RETAINED_CONTRACTS: "required" });
	assert.deepEqual(loaded, ["history", "evidence"]);
	assert.deepEqual(result, { scope: "required", registered: 2 });
});

test("deferred retained contracts do not load archive suites", async () => {
	let loaded = false;
	const result = await registerRetainedContractTests([
		async () => { loaded = true; }
	], { LEAN_BRIDGE_RETAINED_CONTRACTS: "deferred" });
	assert.equal(loaded, false);
	assert.deepEqual(result, { scope: "deferred", registered: 0 });
});

test("sparse consumers defer retained contracts while Core requires them", async () => {
	const [consumers, perl, quality] = await Promise.all([
		readFile(".github/workflows/consumer-matrix.yml", "utf8")
		, readFile(".github/workflows/perl-consumer.yml", "utf8")
		, readFile(".github/workflows/quality.yml", "utf8")
	]);
	for(const job of ["node-consumers", "php-consumers", "native-consumers", "managed-consumers", "wasi-consumer"])
	{
		const source = workflowJob(consumers, job);
		assert.ok(source, job);
		assert.equal(source.match(/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 1, job);
	}
	assert.equal(workflowJob(perl, "perl").match(/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 1);
	assert.equal(workflowJob(quality, "contract").match(/LEAN_BRIDGE_RETAINED_CONTRACTS: required/gu)?.length, 1);
});
