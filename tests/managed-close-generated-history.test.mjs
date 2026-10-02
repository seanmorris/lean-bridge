/**
 * Keep original Python/Ruby generated identities verifiable after close repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { generateOwnedPythonPackage } from "../src/backends/python/owned-package.mjs";
import { ownedPythonRuntime } from "../src/backends/python/owned-runtime.mjs";
import { historicalOwnedRubyCallbackPackage as generateOwnedRubyPackage
	, historicalOwnedRubyCallbackRuntime as ownedRubyRuntime } from "./helpers/owned-ruby-callback-generated-history.mjs";
import { beforeManagedCloseGenerated, historicalManagedClosePythonPackage
	, historicalManagedCloseRubyPackage } from "./helpers/managed-close-generated-history.mjs";

const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true };
const options = { transferredInputs: true, anchoredResults: true };

for(const [language, path, generate, runtime, restore] of [
	["python", "docs/evidence/owned-python-borrows-20260930.json"
		, generateOwnedPythonPackage, ownedPythonRuntime
		, historicalManagedClosePythonPackage]
	, ["ruby", "docs/evidence/owned-ruby-borrows-20260930.json"
		, generateOwnedRubyPackage, ownedRubyRuntime
		, historicalManagedCloseRubyPackage]
]) test(`${language} close repair reconstructs only authenticated generated predecessors`, async () => {
	const record = JSON.parse(await readFile(path, "utf8"));
	for(const item of record.runtime)
	{
		const model = createCompiledNativeModel(item.input, capabilities);
		const generated = generate(model.bindingIr, null, options);
		const source = runtime(generated.c.prefix, options), expected = item.runtimeSha256;
		assert.notEqual(sha256(source), expected);
		const prior = beforeManagedCloseGenerated(source, expected);
		assert.equal(sha256(prior), expected);
		assert.equal(beforeManagedCloseGenerated(prior, expected), prior);
		assert.equal(beforeManagedCloseGenerated(source, "0".repeat(64)), source);
		const unknown = source + "\n# unrecorded generated edit\n";
		assert.equal(beforeManagedCloseGenerated(unknown, expected), unknown);
	}
	for(const item of record.packages)
	{
		const model = createCompiledNativeModel(item.input, capabilities);
		const current = generate(model.bindingIr, null, options);
		const expected = item.adapterReceipt[`${language}Values`];
		const prior = restore(current, expected);
		assert.notEqual(current.contract.runtimeSha256, expected.runtimeSha256);
		assert.deepEqual(prior.contract, expected);
		assert.deepEqual(JSON.parse(prior.files["binding-manifest.json"]).contract, expected);
		assert.strictEqual(restore(prior, expected), prior);
	}
});
