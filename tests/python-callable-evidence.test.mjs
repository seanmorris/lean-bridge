/**
 * Bind Python callable promotion to independent, source-hidden installed runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { pythonCallableSignatures } from "./helpers/python-callable-fixture.mjs";

test("Python callable evidence retains both source paths and all nineteen primitives", async () => {
	const record = JSON.parse(await readFile("docs/evidence/python-callables-20260918.json", "utf8"));
	for(const file of record.sources) assert.equal(file.sha256, sha256(await readFile(file.path)));
	assert.equal(record.consumerSha256, sha256(await readFile("tests/fixtures/callable-consumers/python.py")));
	assert.deepEqual(record.signatures, pythonCallableSignatures);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	assert.equal(record.interpreter, "CPython 3.12.14");
	assert.equal(record.compatibilityExecutions.interpreter, "CPython 3.11.16");
	assert.deepEqual(record.compatibilityExecutions.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of [...record.executions, ...record.compatibilityExecutions.executions])
	{
		assert.equal(run.profile, "python"); assert.ok(run.checks > 49_000);
		assert.equal(run.consumerSha256, record.consumerSha256);
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1);
		assert.equal(run.packages[0].target, "pypi");
		for(const archive of run.packages[0].artifacts) assert.match(archive.sha256, /^[a-f0-9]{64}$/);
	}
});
