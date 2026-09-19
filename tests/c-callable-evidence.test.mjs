/**
 * Bind C callable coverage to the independently specified installed caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { callableSignatures } from "./helpers/callable-fixture.mjs";
import { callableCConsumer, cLifetimeSignature } from "./helpers/callable-c-consumer.mjs";

test("historical raw C callable evidence retains both source paths and archive identities", async () => {
	const record = JSON.parse(await readFile("docs/evidence/c-callables-20260918.json", "utf8"));
	assert.equal(record.sourceSha256, sha256(await readFile("tests/fixtures/onboarding/callables/Callables.lean")));
	assert.equal(record.lifetimeSourceSha256, sha256(await readFile("tests/fixtures/callable-consumers/Lifetimes.lean")));
	assert.match(record.consumerSha256, /^[a-f0-9]{64}$/);
	assert.notEqual(record.consumerSha256, sha256(callableCConsumer()), "The current GMP consumer has its own installed evidence record");
	assert.deepEqual(record.signatures, [...callableSignatures, cLifetimeSignature]);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "c"); assert.ok(run.checks > 47_000);
		assert.equal(run.allocationFailureChecks, 25);
		assert.equal(run.consumerSha256, record.consumerSha256);
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1);
		assert.equal(run.packages[0].target, "c");
		for(const archive of run.packages[0].artifacts) assert.match(archive.sha256, /^[a-f0-9]{64}$/);
	}
});
