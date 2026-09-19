/**
 * Bind Rust callable promotion to independent, source-hidden installed runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { rustCallableSignatures } from "./helpers/rust-callable-fixture.mjs";

test("Rust callable evidence retains both source paths, compile failures and source-free execution", async () => {
	const record = JSON.parse(await readFile("docs/evidence/rust-callables-20260919.json", "utf8"));
	for(const file of record.sources) assert.equal(file.sha256, sha256(await readFile(file.path)));
	assert.equal(record.consumerSha256, sha256(await readFile("tests/fixtures/callable-consumers/rust.rs")));
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(rustCallableSignatures));
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "rust"); assert.ok(run.checks > 35_000);
		assert.equal(run.consumerSha256, record.consumerSha256);
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		assert.equal(run.safety.sourceFreeChecks, run.checks);
		assert.equal(run.safety.faultTests, 1);
		assert.equal(run.safety.faultSourceSha256, sha256(await readFile("tests/fixtures/callable-consumers/rust-faults.rs")));
		assert.deepEqual(run.safety.rejected.map(entry => entry.name), ["argument", "result", "borrowed-callback-input", "closure-argument", "send", "sync", "clone", "async"]);
		assert.ok(run.safety.rejected.every(entry => entry.diagnostics > 0 && /^[a-f0-9]{64}$/.test(entry.sourceSha256)));
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1);
		assert.equal(run.packages[0].target, "cargo");
		for(const archive of run.packages[0].artifacts) assert.match(archive.sha256, /^[a-f0-9]{64}$/);
	}
});
