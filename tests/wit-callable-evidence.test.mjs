/**
 * Bind WIT callable claims to installed packages and independent consumer code.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { beforeWitStructuredCallables } from "./helpers/wit-structured-callable-source-history.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { witCallableSignatures } from "./helpers/wit-callable-fixture.mjs";
import { witCallableConsumer } from "./helpers/wit-callable-consumer.mjs";

test("WIT callable evidence binds both source paths to compiler-free installed execution", async () => {
	const record = JSON.parse(await readFile("docs/evidence/wit-callables-20260919.json"));
	assert.equal(record.wordBits, 64); assert.equal(record.wasmtime, "42.0.1");
	assert.equal(record.lean, "4.32.2");
	for(const [path, hash] of Object.entries(record.sourceHashes))
		assert.equal(sha256(beforeWitStructuredCallables(path, await readFile(path, "utf8"), hash)), hash, path);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const unary = { callback: { parameters: ["uint32"], result: "uint32" } };
	const expected = [...witCallableSignatures
		, { name: "Callables.retainCallback", parameters: [unary], result: unary }
		, { name: "Callables.makeAdder", parameters: ["uint32"], result: unary }];
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	for(const run of record.executions)
	{
		assert.deepEqual(sort(run.signatures), sort(expected));
		assert.equal(run.checks, 4905); // Component call attempts, including nested/rejected calls.
		assert.equal(run.compilerFreePath, true); assert.equal(run.offlineInstall, true);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		assert.equal(run.consumerSha256, sha256(await witCallableConsumer()));
		for(const key of ["bindingIrSha256", "modelSha256", "sourceTreeSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/u);
		assert.equal(run.packages.length, 1);
		assert.equal(run.packages[0].ecosystem, "wit-wasi");
		assert.equal(run.packages[0].runtimeDelivery, "embedded");
		assert.match(run.packages[0].artifacts[0].sha256, /^[a-f0-9]{64}$/u);
	}
});
