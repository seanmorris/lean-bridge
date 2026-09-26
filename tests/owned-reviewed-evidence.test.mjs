/**
 * Require actual reviewed C execution while retaining all installed observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedReviewedExecution, assertOwnedReviewedIntegration } from "./helpers/owned-reviewed-evidence.mjs";
import { beforeOwnedReviewed, reverseOwnedReviewedUpdate, ownedReviewedHistoryPath, ownedReviewedExecutionPath } from "./helpers/owned-reviewed-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("reviewed owned evidence authenticates fresh Lean and independent C execution", async () => {
	await assertOwnedReviewedIntegration(await json(ownedReviewedHistoryPath));
});

test("reviewed owned evidence rejects weakened execution and unsupported scope claims", async () => {
	const original = await json(ownedReviewedExecutionPath);
	for(const change of [
		record => { record.scope.installedPackage = true; }
		, record => { record.scope.hostCallbackConstruction = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.scope.promotedCells++; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import substitute.mjs"; }
		, record => { record.run.text += "edited"; }
		, record => { delete record.sources["src/analyze/reviewed-owned-source.mjs"]; }
		, record => { record.report.headerSha256 = "0".repeat(64); }
		, record => { record.report.checks.live = 1; }
		, record => { record.report.checks.failures--; }
		, record => { record.report.orderedShapeDriftRejected = false; }
		, record => { record.report.startupLeakBaseline = ""; }
		, record => { record.report.reviewedSourceSha256 = "0".repeat(64); }
		, record => { record.inputs.shapeNegative = record.inputs.reviewed; }
		, record => { record.inputs.reviewed.sourceIdentity.extractorSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedReviewedExecution(changed), change.toString());
	}
});

test("reviewed owned source history rejects unknown text and overlapping edits", async () => {
	for(const update of (await json(ownedReviewedHistoryPath)).updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseOwnedReviewedUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedReviewed(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedReviewed(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedReviewed(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedReviewedUpdate(unknown, update));
		assert.throws(() => reverseOwnedReviewedUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedReviewedUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});
