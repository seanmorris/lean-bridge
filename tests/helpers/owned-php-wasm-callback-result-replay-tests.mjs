/**
 * Replay retained PHP-Wasm callback evidence without compilers or browsers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmOwned } from "../../src/build/php-wasm-owned-component.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { assertOwnedPhpWasmCallbackReport, ownedPhpWasmCallbackResultEvidencePath
	, unpackOwnedPhpWasmCallbackResultReports } from "./owned-php-wasm-callback-result-evidence.mjs";
import {
	ownedPhpWasmCallbackProducer, ownedPhpWasmCallbackProducerEntries
	, ownedPhpWasmCallbackProducerClosure, ownedPhpWasmCallbackReplay
} from "./owned-php-wasm-callback-result-replay.mjs";

let retained;
const record = async () => {
	if(retained) return retained;
	const bytes = await readFile(ownedPhpWasmCallbackResultEvidencePath);
	assert.equal(bytes.length, 680837);
	assert.equal(sha256(bytes), "50a7bf4e3b83db76530c5e4983a7a4eb4fd348d001ea17e3ff747b1e69314ddb");
	const value = JSON.parse(bytes);
	retained = { ...value, reports: unpackOwnedPhpWasmCallbackResultReports(value.reports) };
	assert.equal(Object.keys(retained.reports).length, 3);
	return retained;
};
let selected;
const replay = async () => selected ??= await ownedPhpWasmCallbackReplay((await record()).sources);

test("PHP-Wasm replay authenticates all 114 imports and its exact source map", async () => {
	const { sources } = await record();
	assert.equal(ownedPhpWasmCallbackProducer, "39a82da8a81730db7d576b706011f20ea4a29892");
	assert.equal(ownedPhpWasmCallbackProducerEntries.length, 3);
	assert.equal(Object.keys(sources).length, 17);
	const closure = ownedPhpWasmCallbackProducerClosure(sources);
	assert.deepEqual(closure, [...new Set(closure)].sort());
	assert.equal(closure.length, 114);
	for(const path of ownedPhpWasmCallbackProducerEntries) assert.ok(closure.includes(path), path);
	for(const path of Object.keys(sources))
	{
		const missing = { ...sources }; delete missing[path];
		assert.throws(() => ownedPhpWasmCallbackProducerClosure(missing));
		assert.throws(() => ownedPhpWasmCallbackProducerClosure({ ...sources, [path]: "0".repeat(64) }));
	}
	const omitted = "src/analyze/spdx-data.json";
	assert.ok(closure.includes(omitted));
	assert.equal(Object.hasOwn(sources, omitted), false);
	assert.throws(() => ownedPhpWasmCallbackProducerClosure({ ...sources, [omitted]: "0".repeat(64) }));
	await assert.rejects(ownedPhpWasmCallbackReplay(null));
});

test("PHP-Wasm replay preserves current generators for fresh recording", async () => {
	const fresh = await ownedPhpWasmCallbackReplay();
	assert.equal(fresh.createCompiledPhpWasmModel, createCompiledPhpWasmModel);
	assert.equal(fresh.generateCompiledPhpWasmLeanAdapters, generateCompiledPhpWasmLeanAdapters);
	assert.equal(fresh.generateCompiledPhpWasmOwned, generateCompiledPhpWasmOwned);
	assert.equal(fresh.phpWasmCopiedPins, phpWasmCopiedPins);
	const historical = await replay();
	assert.notEqual(historical.createCompiledPhpWasmModel, fresh.createCompiledPhpWasmModel);
	assert.notEqual(historical.generateCompiledPhpWasmOwned, fresh.generateCompiledPhpWasmOwned);
	assert.notEqual(historical.phpWasmCopiedPins, fresh.phpWasmCopiedPins);
	const { sources } = await record();
	historical.assertSources(sources);
	assert.throws(() => historical.assertSources({}));
	assert.throws(() => historical.assertSources({ ...sources, "package.json": "0".repeat(64) }));
});

for(const name of ["no-host", "host", "combined"])
	test("PHP-Wasm retained package report: " + name, async () => {
		const original = await record();
		await assertOwnedPhpWasmCallbackReport(name, original.reports[name + "-packages.json"]
			, original.runtimeIdentity, await replay());
	});

test("PHP-Wasm replay rejects unrecorded variants after accepting a recorded report", async () => {
	const original = await record();
	const report = original.reports["combined-packages.json"];
	const context = await replay();
	await assertOwnedPhpWasmCallbackReport("combined", report, original.runtimeIdentity, context);
	await assert.rejects(assertOwnedPhpWasmCallbackReport("unrecorded", report, original.runtimeIdentity, context));
});
