/**
 * Preserve all installed receipts while authenticating the C projection stage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedCExecution, assertOwnedCIntegration } from "./helpers/owned-c-evidence.mjs";
import { beforeOwnedC, reverseOwnedCUpdate, ownedCHistoryPath, ownedCExecutionPath } from "./helpers/owned-c-source-history.mjs";
import { beforeOwnedReviewed } from "./helpers/owned-reviewed-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("public C evidence authenticates native execution without promoting installed cells", async () => {
	await assertOwnedCIntegration(await json(ownedCHistoryPath));
});

test("public C evidence rejects source drift, missing controls and broader support claims", async () => {
	const original = await json(ownedCExecutionPath);
	for(const change of [
		record => { record.scope.installedPackage = true; }
		, record => { record.scope.hostCallbackConstruction = true; }
		, record => { record.scope.reviewedSource = true; }
		, record => { record.scope.promotedCells++; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import substitute.mjs"; }
		, record => { record.run.text += "edited"; }
		, record => { delete record.sources["src/backends/native/runtime-broker.mjs"]; }
		, record => { record.reports["public-c"].headerSha256 = "0".repeat(64); }
		, record => { record.reports["public-c"].result.live = 1; }
		, record => { record.reports["public-c"].rejectedMutations.pop(); }
		, record => { record.reports["public-c"].malformedResultRetiresRuntime = false; }
		, record => { record.reports["public-c"].cppHeaderCompiled = false; }
		, record => { record.reports["public-c-scalars"].directLeanLeakBaseline.repetitions = [1]; }
		, record => { record.reports["public-c-scalars"].startupLeakBaseline += "suppressed"; }
		, record => { record.reports["public-c-scalars"].result.failures--; }
		, record => { record.reports.transport.result.allocationFailures--; }
		, record => { record.inputs.aggregates.sourceIdentity.extractorSha256 = "0".repeat(64); }
	]) {
		const record = structuredClone(original); change(record);
		await assert.rejects(() => assertOwnedCExecution(record), change.toString());
	}
});

test("public C source history rejects unknown text and ambiguous reverse edits", async () => {
	for(const update of (await json(ownedCHistoryPath)).updates)
	{
		const source = beforeOwnedReviewed(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseOwnedCUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedC(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedC(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedC(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedCUpdate(unknown, update));
		assert.throws(() => reverseOwnedCUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedCUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});
