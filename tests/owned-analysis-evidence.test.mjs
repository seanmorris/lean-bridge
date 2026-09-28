/**
 * Preserve compiler-analysis evidence and every earlier structured-type receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedAnalysisExecution } from "./helpers/owned-analysis-evidence.mjs";
import { ownedZendBailoutHistoricalBytes } from "./helpers/owned-zend-bailout-repair-history.mjs";
import { beforeOwnedAnalysis, ownedAnalysisAddedPaths, ownedAnalysisBaseline
	, ownedAnalysisBaselineSources, ownedAnalysisChangedPaths, ownedAnalysisHistoryPath
	, ownedAnalysisPrevious, reverseOwnedAnalysisUpdate } from "./helpers/owned-analysis-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("ownership analysis receipt binds current sources and preserves earlier package evidence", async () => {
	const record = await json(ownedAnalysisHistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-analysis-integration");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedAnalysisBaseline);
	assert.deepEqual(record.previous, ownedAnalysisPrevious);
	assert.deepEqual(record.baselineSources, ownedAnalysisBaselineSources);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedAnalysisChangedPaths, ...ownedAnalysisAddedPaths])].sort());
	for(const [path, hash] of Object.entries(record.sources))
		assert.equal(sha256(ownedZendBailoutHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedAnalysisChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path] ?? ownedAnalysisBaselineSources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = ownedZendBailoutHistoricalBytes(update.path, await readFile(update.path), update.currentSha256).toString();
		const prior = beforeOwnedAnalysis(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedAnalysis(update.path, prior), prior);
		assert.equal(beforeOwnedAnalysis(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded analysis change */\n";
		assert.equal(beforeOwnedAnalysis(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedAnalysisUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }, { ...update, path: "unknown.mjs" }, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedAnalysisUpdate(current, changed));
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedAnalysis("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior, "Compiler analysis must not promote untested installed support");
});

test("ownership analysis evidence requires real compilation and complete regression execution", async () => {
	await assertOwnedAnalysisExecution(await json(ownedAnalysisHistoryPath));
});

test("ownership analysis evidence rejects missing source paths, skipped checks and expanded claims", async () => {
	const original = await json(ownedAnalysisHistoryPath);
	const rewrite = (record, before, after) => {
		const run = record.runs.execution, text = run.text.replace(before, after);
		assert.notEqual(text, run.text); run.text = text; run.sha256 = sha256(text);
	};
	for(const mutate of [
		record => { record.scope.testedNixDockerIsolation = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.repair.analysis.exitCode = 0; }
		, record => { record.repair.word.exitCode = 0; }
		, record => { record.runs.execution.text += "changed"; }
		, record => rewrite(record, "# skipped 0", "# skipped 1")
		, record => rewrite(record, '"reviewed":true', '"reviewed":false')
		, record => rewrite(record, '"exports":51', '"exports":1')
		, record => rewrite(record, '"analyzerAdaptersCompiled":false', '"analyzerAdaptersCompiled":true')
		, record => rewrite(record, '"producerRemoved":true', '"producerRemoved":false')
		, record => rewrite(record, '"authenticatedMutationRejections":11', '"authenticatedMutationRejections":0')
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedAnalysisExecution(changed), mutate.toString());
	}
});
