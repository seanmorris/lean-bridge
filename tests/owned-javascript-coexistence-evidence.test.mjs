/**
 * Preserve previous installed results and require complete shared-runtime proof.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedJavaScriptCoexistenceExecution } from "./helpers/owned-javascript-coexistence-evidence.mjs";
import { beforeOwnedJavaScriptCoexistence, ownedJavaScriptCoexistenceAddedPaths
	, ownedJavaScriptCoexistenceBaseline, ownedJavaScriptCoexistenceChangedPaths
	, ownedJavaScriptCoexistenceHistoryPath, ownedJavaScriptCoexistenceHistoricalBytes
	, ownedJavaScriptCoexistencePrevious, reverseOwnedJavaScriptCoexistenceUpdate } from "./helpers/owned-javascript-coexistence-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("coexistence receipt binds every current source without rewriting installed npm history", async () => {
	const record = await json(ownedJavaScriptCoexistenceHistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-coexistence-integration");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJavaScriptCoexistenceBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptCoexistencePrevious);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedJavaScriptCoexistenceChangedPaths, ...ownedJavaScriptCoexistenceAddedPaths])].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptCoexistenceChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = await readFile(update.path, "utf8"), prior = beforeOwnedJavaScriptCoexistence(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedJavaScriptCoexistence(update.path, prior), prior);
		assert.equal(beforeOwnedJavaScriptCoexistence(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded coexistence change */\n";
		assert.equal(beforeOwnedJavaScriptCoexistence(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJavaScriptCoexistenceUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }, { ...update, path: "unknown.mjs" }, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedJavaScriptCoexistenceUpdate(current, changed));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(ownedJavaScriptCoexistenceHistoricalBytes("unknown.bin", binary), binary);
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedJavaScriptCoexistence("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior, "No type-surface support cells are promoted");
});

test("installed coexistence requires repaired archives, all load orders and every browser context", async () => {
	await assertOwnedJavaScriptCoexistenceExecution(await json(ownedJavaScriptCoexistenceHistoryPath));
});

test("coexistence evidence rejects extra heaps, omitted contexts, weakened cleanup and wider scope", async () => {
	const original = await json(ownedJavaScriptCoexistenceHistoryPath);
	const rewrite = (record, before, after) => {
		const run = record.runs.execution, text = run.text.replace(before, after);
		assert.notEqual(text, run.text); run.text = text; run.sha256 = sha256(text);
	};
	for(const mutate of [
		record => { record.scope.signedPublication = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.repair.before.exitCode = 0; }
		, record => { record.repair.after = record.repair.before; }
		, record => { record.runs.execution.exitCode = 1; }
		, record => { record.runs.execution.text += "changed"; }
		, record => rewrite(record, "# skipped 0", "# skipped 1")
		, record => rewrite(record, '"heaps":1', '"heaps":2')
		, record => rewrite(record, '"initializations":1', '"initializations":2')
		, record => rewrite(record, '"identities":0', '"identities":1')
		, record => rewrite(record, '"strictTypeScript":true', '"strictTypeScript":false')
		, record => rewrite(record, '"order":"concurrent"', '"order":"owned-first"')
		, record => rewrite(record, '"engine":"firefox"', '"engine":"chromium"')
		, record => rewrite(record, '"profile":"worker"', '"profile":"page"')
		, record => rewrite(record, '"checks":22', '"checks":21')
		, record => rewrite(record, '"reruns":2', '"reruns":0')
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedJavaScriptCoexistenceExecution(changed), mutate.toString());
	}
});
