/**
 * Keep private owned execution distinct from installed package support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedAggregateExecution, assertOwnedAggregateIntegration } from "./helpers/owned-aggregate-evidence.mjs";
import { beforeOwnedAggregates, reverseOwnedAggregateUpdate, ownedAggregateHistoryPath, ownedAggregateExecutionPath } from "./helpers/owned-aggregate-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("owned native integration preserves every installed cell and exact predecessor source", async () => {
	await assertOwnedAggregateIntegration(await json(ownedAggregateHistoryPath));
});

test("owned execution rejects unexecuted support, source drift and missing cleanup controls", async () => {
	const original = await json(ownedAggregateExecutionPath);
	for(const change of [
		record => { record.scope.installedPackage = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.native.exitCode = 1; }
		, record => { record.native.text += "edited"; }
		, record => { record.native.command += " --import substitute.mjs"; }
		, record => { delete record.sources["src/analyze/NativeExports.lean"]; }
		, record => { record.reports.values.adapterSha256 = "0".repeat(64); }
		, record => { record.reports.values.result.live = 1; }
		, record => { record.reports.values.rejectedMutations.pop(); }
		, record => { record.reports.scalars.directLeanLeakBaseline.repetitions = [1]; }
		, record => { record.reports.scalars.directLeanLeakBaseline.unchangedAfterCalls = false; }
		, record => { record.reports.scalars.startupLeakBaseline.report += "suppressed"; }
		, record => { record.reports.transport.result.allocationFailures--; }
		, record => { record.inputs.aggregates.sourceIdentity.extractorSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedAggregateExecution(changed), change.toString());
	}
});

test("owned source history rejects unknown text, wrong predecessors and overlapping edits", async () => {
	for(const update of (await json(ownedAggregateHistoryPath)).updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseOwnedAggregateUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedAggregates(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedAggregates(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedAggregates(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedAggregateUpdate(unknown, update));
		assert.throws(() => reverseOwnedAggregateUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedAggregateUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});
