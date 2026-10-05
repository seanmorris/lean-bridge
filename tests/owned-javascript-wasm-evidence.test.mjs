/**
 * Authenticate the JS ownership milestone and preserve the frozen PHP receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedJavaScriptWasmExecution } from "./helpers/owned-javascript-wasm-evidence.mjs";
import { beforeOwnedJavaScriptNpm, ownedJavaScriptNpmHistoricalBytes } from "./helpers/owned-javascript-npm-source-history.mjs";
import { beforeOwnedJavaScriptWasm, ownedJavaScriptWasmAddedPaths
	, ownedJavaScriptWasmAdditionalSources, ownedJavaScriptWasmBaseline
	, ownedJavaScriptWasmBaselineSources, ownedJavaScriptWasmChangedPaths
	, ownedJavaScriptWasmHistoricalBytes, ownedJavaScriptWasmHistoryPath
	, ownedJavaScriptWasmPrevious, reverseOwnedJavaScriptWasmUpdate } from "./helpers/owned-javascript-wasm-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("JavaScript ownership authenticates every source change without rewriting PHP evidence", async () => {
	const record = await json(ownedJavaScriptWasmHistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-javascript-wasm-integration");
	assert.equal(record.baselineRevision, ownedJavaScriptWasmBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptWasmPrevious);
	assert.deepEqual(record.baselineSources, ownedJavaScriptWasmBaselineSources);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([
		...Object.keys(previous.sources), ...ownedJavaScriptWasmChangedPaths
		, ...ownedJavaScriptWasmAddedPaths, ...ownedJavaScriptWasmAdditionalSources
	])].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedJavaScriptNpmHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptWasmChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path] ?? ownedJavaScriptWasmBaselineSources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = beforeOwnedJavaScriptNpm(update.path, await readFile(update.path, "utf8"), update.currentSha256), prior = beforeOwnedJavaScriptWasm(update.path, current);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedJavaScriptWasm(update.path, prior), prior);
		assert.equal(beforeOwnedJavaScriptWasm(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded JavaScript/Wasm edit */\n";
		assert.equal(beforeOwnedJavaScriptWasm(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJavaScriptWasmUpdate(unknown, update));
		assert.throws(() => reverseOwnedJavaScriptWasmUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedJavaScriptWasmUpdate(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseOwnedJavaScriptWasmUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(ownedJavaScriptWasmHistoricalBytes("unknown.bin", binary), binary);
	const inventoryPath = "docs/type-surface.v1.json";
	const current = ownedJavaScriptNpmHistoricalBytes(inventoryPath, await readFile(inventoryPath)
		, record.sources[inventoryPath]).toString("utf8");
	const prior = JSON.parse(beforeOwnedJavaScriptWasm("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files)
		if(record.sources[file.path]) file.sha256 = record.sources[file.path];
	assert.deepEqual(JSON.parse(current), prior, "Only source hashes change; support classifications stay unchanged");
});

test("JavaScript ownership evidence requires fresh Lean, production heaps and typed public APIs", async () => {
	await assertOwnedJavaScriptWasmExecution(await json(ownedJavaScriptWasmHistoryPath));
});

test("JavaScript ownership evidence rejects installed claims, skipped cases and cleanup regressions", async () => {
	const original = await json(ownedJavaScriptWasmHistoryPath);
	await assertOwnedJavaScriptWasmExecution(original);
	const rewrite = (record, before, after) => {
		const run = record.runs.execution, changed = run.text.replace(before, after);
		assert.notEqual(changed, run.text); run.text = changed; run.sha256 = sha256(changed);
	};
	for(const mutate of [
		record => { record.scope.installedNpm = true; }
		, record => { record.scope.installedBrowser = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.runs.execution.exitCode = 1; }
		, record => { record.runs.execution.command += " --import unverified.mjs"; }
		, record => { record.runs.execution.text += "altered"; }
		, record => { record.runs.ci = record.runs.execution; }
		, record => { record.scalarReplyRepair.before.exitCode = 0; }
		, record => { record.scalarReplyRepair.after = record.scalarReplyRepair.before; }
		, record => rewrite(record, "# skipped 0", "# skipped 1")
		, record => rewrite(record, /^ok 1 - [^\n]+\n/mu, "")
		, record => rewrite(record, '"source":"reviewed"', '"source":"ordinary"')
		, record => rewrite(record, '"reentries":63', '"reentries":1')
		, record => rewrite(record, '"nativeFaults":47', '"nativeFaults":0')
		, record => rewrite(record, '"live":[0,0,0,0]', '"live":[1,0,0,0]')
		, record => rewrite(record, '"coreInitializations":1', '"coreInitializations":2')
		, record => rewrite(record, '"owners":0', '"owners":1')
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedJavaScriptWasmExecution(changed), mutate.toString());
	}
});
