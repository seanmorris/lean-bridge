/**
 * Bind public GMP mappings to exact, source-free installed acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { gmpIdentity } from "../src/backends/c/gmp.mjs";
import { callableCConsumer, cLifetimeSignature } from "./helpers/callable-c-consumer.mjs";
import { callableSignatures } from "./helpers/callable-fixture.mjs";

test("C GMP evidence retains both paths, dependency identity and source-free execution", async () => {
	const record = JSON.parse(await readFile("docs/evidence/c-gmp-20260919.json"));
	assert.equal(record.consumerSha256, sha256(callableCConsumer()));
	const byName = signatures => Object.fromEntries(signatures.map(signature => [signature.name, signature]));
	assert.deepEqual(byName(record.signatures), byName([...callableSignatures, cLifetimeSignature]));
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "c"); assert.ok(run.checks > 47_000);
		assert.equal(run.consumerSha256, record.consumerSha256);
		assert.equal(run.allocationFailureChecks, 25);
		assert.ok(run.gmpAllocationFailureChecks > 5);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(run[key], true);
		assert.equal(run.gmp.sourceFreeChecks, run.checks);
		assert.equal(run.gmp.sourceFree, true); assert.equal(run.gmp.localGmp, true);
		for(const [key, value] of Object.entries(gmpIdentity)) assert.equal(run.gmp.dependency[key], value);
		assert.equal(run.gmp.dependency.checked, true);
		assert.deepEqual(run.gmp.rejected.map(item => item.name), ["argument", "private-limbs"]);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(run.packages[0].target, "c");
		for(const archive of run.packages[0].artifacts) assert.match(archive.sha256, /^[a-f0-9]{64}$/);
	}
	assert.equal(record.packageGlibcFloor, "2.38");
	for(const report of record.corpora)
	{
		assert.match(report.sha256, /^[a-f0-9]{64}$/);
		const runs = report.runs.filter(run => run.profile === "c"); assert.equal(runs.length, 2);
		for(const run of runs)
		{
			assert.deepEqual(run.counts, { matched: 47, "rejected-as-expected": 2, "rejected-at-compile-time": 13 });
			assert.equal(run.offline, true); assert.equal(run.installedSourcesRemoved, true);
			assert.deepEqual(run.integrationExecutions, { "pkg-config": 2, cmake: 2 });
			assert.match(run.archive.sha256, /^[a-f0-9]{64}$/);
		}
	}
	assert.deepEqual(record.corpora.map(report => report.runs[0].path), ["ordinary-source", "reviewed-ir"]);
	assert.deepEqual(record.regressions.map(suite => suite.passed), [4, 3]);
});
