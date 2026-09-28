/**
 * Keep signed ownership publication evidence exact and prior receipts immutable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeCoreHistoryPerformance, coreHistoryHistoricalBytes } from "./helpers/core-history-performance-history.mjs";
import { assertOwnedJavaScriptPublicationExecution } from "./helpers/owned-javascript-publication-evidence.mjs";
import { beforeOwnedJavaScriptPublication, ownedJavaScriptPublicationAddedPaths
	, ownedJavaScriptPublicationBaseline, ownedJavaScriptPublicationBaselineSources
	, ownedJavaScriptPublicationChangedPaths, ownedJavaScriptPublicationHistoryPath
	, ownedJavaScriptPublicationPrevious, reverseOwnedJavaScriptPublicationUpdate } from "./helpers/owned-javascript-publication-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJavaScriptPublicationHistoryPath, "utf8"));

test("owned publication binds exact source changes without rewriting engine evidence", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-publication");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJavaScriptPublicationBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptPublicationPrevious);
	assert.deepEqual(record.baselineSources, ownedJavaScriptPublicationBaselineSources);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources)
		, ...Object.keys(ownedJavaScriptPublicationBaselineSources)
		, ...ownedJavaScriptPublicationAddedPaths])].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(coreHistoryHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptPublicationChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path] ?? ownedJavaScriptPublicationBaselineSources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = beforeCoreHistoryPerformance(update.path, await readFile(update.path, "utf8")), prior = beforeOwnedJavaScriptPublication(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedJavaScriptPublication(update.path, prior), prior);
		assert.equal(beforeOwnedJavaScriptPublication(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded publication change */\n";
		assert.equal(beforeOwnedJavaScriptPublication(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJavaScriptPublicationUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }, { ...update, path: "unknown.mjs" }, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedJavaScriptPublicationUpdate(current, changed));
	}
	const current = beforeCoreHistoryPerformance("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const prior = JSON.parse(beforeOwnedJavaScriptPublication("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(coreHistoryHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), prior, "Publication must not promote unverified isolated or cross-language support");
});

test("owned publication evidence requires two clean builds, signed receipts and relocated consumers", async () => {
	assertOwnedJavaScriptPublicationExecution(await read());
});

test("owned publication evidence rejects skipped checks and unsupported scope claims", async () => {
	const original = await read();
	const rewrite = (record, before, after) => {
		const run = record.runs.publication, text = run.text.replace(before, after);
		assert.notEqual(text, run.text); run.text = text; run.sha256 = sha256(text);
	};
	for(const mutate of [
		record => { record.scope.nixIsolation = true; }
		, record => { record.scope.externalRegistryWrites = true; }
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { delete record.runs.cli; }
		, record => { record.runs.copied.exitCode = 1; }
		, record => { record.runs.publication.text += "unrecorded"; }
		, record => rewrite(record, "# skipped 0", "# skipped 1")
		, record => rewrite(record, '"cleanBuilds":2', '"cleanBuilds":1')
		, record => rewrite(record, '"signedPublication":true', '"signedPublication":false')
		, record => rewrite(record, '"idempotentWrites":1', '"idempotentWrites":2')
		, record => rewrite(record, '"standaloneVerification":true', '"standaloneVerification":false')
		, record => rewrite(record, '"rejectedMutations":8', '"rejectedMutations":0')
		, record => rewrite(record, '"publicationRejected":true', '"publicationRejected":false')
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => assertOwnedJavaScriptPublicationExecution(changed), undefined, mutate.toString());
	}
});
