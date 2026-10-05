/**
 * Preserve the runtime milestone while authenticating installed npm delivery.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedJavaScriptNpmExecution } from "./helpers/owned-javascript-npm-evidence.mjs";
import { beforeOwnedJavaScriptCoexistence, ownedJavaScriptCoexistenceHistoricalBytes } from "./helpers/owned-javascript-coexistence-source-history.mjs";
import { beforeOwnedJavaScriptNpm, ownedJavaScriptNpmAddedPaths
	, ownedJavaScriptNpmBaseline, ownedJavaScriptNpmBaselineSources
	, ownedJavaScriptNpmChangedPaths, ownedJavaScriptNpmHistoryPath
	, ownedJavaScriptNpmHistoricalBytes, ownedJavaScriptNpmPrevious
	, reverseOwnedJavaScriptNpmUpdate } from "./helpers/owned-javascript-npm-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("installed owned npm evidence binds exact sources without rewriting runtime history", async () => {
	const record = await json(ownedJavaScriptNpmHistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-npm-integration");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJavaScriptNpmBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptNpmPrevious); assert.deepEqual(record.baselineSources, ownedJavaScriptNpmBaselineSources);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedJavaScriptNpmChangedPaths, ...ownedJavaScriptNpmAddedPaths])].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedJavaScriptCoexistenceHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptNpmChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path] ?? ownedJavaScriptNpmBaselineSources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = beforeOwnedJavaScriptCoexistence(update.path, await readFile(update.path, "utf8"), update.currentSha256), prior = beforeOwnedJavaScriptNpm(update.path, current);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedJavaScriptNpm(update.path, prior), prior);
		assert.equal(beforeOwnedJavaScriptNpm(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded installed npm edit */\n";
		assert.equal(beforeOwnedJavaScriptNpm(update.path, unknown), unknown);
		for(const change of [{ ...update, previousSha256: "0".repeat(64) }, { ...update, path: "unknown.mjs" }, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedJavaScriptNpmUpdate(current, change));
		assert.throws(() => reverseOwnedJavaScriptNpmUpdate(unknown, update));
	}
	const bytes = Buffer.from([0, 255, 192, 128]); assert.equal(ownedJavaScriptNpmHistoricalBytes("unknown.bin", bytes), bytes);
	const inventoryPath = "docs/type-surface.v1.json";
	const current = ownedJavaScriptCoexistenceHistoricalBytes(inventoryPath, await readFile(inventoryPath)
		, record.sources[inventoryPath]).toString("utf8");
	const prior = JSON.parse(beforeOwnedJavaScriptNpm("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files)
		if(record.sources[file.path]) file.sha256 = record.sources[file.path];
	assert.deepEqual(JSON.parse(current), prior, "Only current file identities change; support cells are not promoted");
});

test("installed owned npm evidence requires both author paths and all browser contexts", async () => {
	await assertOwnedJavaScriptNpmExecution(await json(ownedJavaScriptNpmHistoryPath));
});

test("installed owned npm evidence rejects omitted consumers, changed observations and expanded claims", async () => {
	const original = await json(ownedJavaScriptNpmHistoryPath);
	const rewrite = (record, before, after) => {
		const run = record.runs.execution, text = run.text.replace(before, after);
		assert.notEqual(text, run.text); run.text = text; run.sha256 = sha256(text);
	};
	for(const change of [
		record => { record.scope.signedPublication = true; }
		, record => { record.scope.nixDockerBuilds = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.runs.execution.exitCode = 1; }
		, record => { record.runs.execution.command += " --import unsafe.mjs"; }
		, record => { record.runs.execution.text += "unknown"; }
		, record => rewrite(record, "# skipped 0", "# skipped 1")
		, record => rewrite(record, '"installedCli":true', '"installedCli":false')
		, record => rewrite(record, '"combinedNative":true', '"combinedNative":false')
		, record => rewrite(record, '"installedTypeScript":true', '"installedTypeScript":false')
		, record => rewrite(record, '"engine":"firefox"', '"engine":"chromium"')
		, record => rewrite(record, '"profile":"worker"', '"profile":"page"')
		, record => rewrite(record, '"checks":16', '"checks":15')
		, record => rewrite(record, '"reruns":2', '"reruns":0')
	]) {
		const record = structuredClone(original); change(record);
		await assert.rejects(assertOwnedJavaScriptNpmExecution(record), change.toString());
	}
});
