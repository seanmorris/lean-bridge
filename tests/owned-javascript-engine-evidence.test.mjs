/**
 * Authenticate the owned npm engine milestone and preserve prior support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedJavaScriptEngineExecution } from "./helpers/owned-javascript-engine-evidence.mjs";
import { beforeOwnedJavaScriptPublication, ownedJavaScriptPublicationHistoricalBytes } from "./helpers/owned-javascript-publication-history.mjs";
import { beforeOwnedJavaScriptEngine, ownedJavaScriptEngineAddedPaths, ownedJavaScriptEngineBaseline
	, ownedJavaScriptEngineBaselineSources, ownedJavaScriptEngineChangedPaths, ownedJavaScriptEngineHistoryPath
	, ownedJavaScriptEnginePrevious, reverseOwnedJavaScriptEngineUpdate } from "./helpers/owned-javascript-engine-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJavaScriptEngineHistoryPath, "utf8"));

test("owned npm engine integration authenticates source changes without rewriting prior receipts", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-engine-integration");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJavaScriptEngineBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptEnginePrevious);
	assert.deepEqual(record.baselineSources, ownedJavaScriptEngineBaselineSources);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources)
		, ...Object.keys(ownedJavaScriptEngineBaselineSources)
		, ...ownedJavaScriptEngineAddedPaths])].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedJavaScriptPublicationHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptEngineChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path] ?? ownedJavaScriptEngineBaselineSources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = beforeOwnedJavaScriptPublication(update.path, await readFile(update.path, "utf8"), update.currentSha256), prior = beforeOwnedJavaScriptEngine(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedJavaScriptEngine(update.path, prior), prior);
		assert.equal(beforeOwnedJavaScriptEngine(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded engine change */\n";
		assert.equal(beforeOwnedJavaScriptEngine(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJavaScriptEngineUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }, { ...update, path: "unknown.mjs" }, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedJavaScriptEngineUpdate(current, changed));
	}
	const current = beforeOwnedJavaScriptPublication("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"), record.sources["docs/type-surface.v1.json"]);
	const prior = JSON.parse(beforeOwnedJavaScriptEngine("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedJavaScriptPublicationHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior, "Engine acceptance must not promote unverified isolated or installed support");
});

test("owned npm engine evidence requires compiled source, archive SDKs and installed consumers", async () => {
	assertOwnedJavaScriptEngineExecution(await read());
});

test("owned npm engine evidence rejects skips, weakened checks and unsupported isolation claims", async () => {
	const original = await read();
	const rewrite = (record, before, after) => {
		const run = record.runs.engine, text = run.text.replace(before, after);
		assert.notEqual(text, run.text); run.text = text; run.sha256 = sha256(text);
	};
	for(const mutate of [
		record => { record.scope.nixIsolation = true; }
		, record => { record.scope.signedPublication = true; }
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { delete record.runs.cli; }
		, record => { record.runs.runtime.exitCode = 1; }
		, record => { record.runs.engine.text += "unrecorded"; }
		, record => rewrite(record, "# skipped 0", "# skipped 1")
		, record => rewrite(record, '"sourceUnchanged":true', '"sourceUnchanged":false')
		, record => rewrite(record, '"inputUnchanged":true', '"inputUnchanged":false')
		, record => rewrite(record, '"rejectedMutations":6', '"rejectedMutations":0')
		, record => rewrite(record, '"ignoredHostSdk":true', '"ignoredHostSdk":false')
		, record => rewrite(record, '"generatedResult":32', '"generatedResult":0')
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => assertOwnedJavaScriptEngineExecution(changed), undefined, mutate.toString());
	}
});
