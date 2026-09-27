/**
 * Reject incomplete CI routing and unauthenticated predecessor normalization.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertManagedCiIsolationEvidence } from "./helpers/managed-ci-isolation-evidence.mjs";
import { beforeManagedCiIsolation, managedCiIsolationHistoricalBytes, managedCiIsolationPath, reverseManagedCiIsolation } from "./helpers/managed-ci-isolation-history.mjs";
import { nativeForkRepairHistoricalBytes } from "./helpers/native-fork-repair-history.mjs";
import { ownedDotnetHistoricalBytes } from "./helpers/owned-dotnet-source-history.mjs";
import { ownedRubyHistoricalBytes } from "./helpers/owned-ruby-source-history.mjs";

const receipt = async () => JSON.parse(await readFile(managedCiIsolationPath, "utf8"));

test("managed CI isolation preserves complete acceptance commands and original receipts", async () => {
	await assertManagedCiIsolationEvidence(await receipt());
});

test("managed CI evidence rejects dropped profiles, commands and manufactured execution", async () => {
	const original = await receipt();
	for(const change of [
		record => { record.scope.profiles.pop(); }
		, record => { record.scope.baselineRetained = false; }
		, record => { record.scope.acceptanceCommandsRetained = false; }
		, record => { record.scope.installedExecutionClaim = true; }
		, record => { record.scope.failFast = true; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { delete record.sources[".github/workflows/consumer-matrix.yml"]; }
		, record => { record.updates[0].previousSha256 = "0".repeat(64); }
		, record => { record.updates[0].edits[0].previous += "unrecorded"; }
		, record => { record.routing.commandsCompared = 5; }
		, record => { record.routing.selectedOutcomeCases = 26; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import substitute.mjs"; }
		, record => { record.inventory.promoted = 1; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertManagedCiIsolationEvidence(changed, false), change.toString());
	}
});

test("managed CI history authenticates whole files through every recent evidence layer", async () => {
	for(const update of (await receipt()).updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(beforeManagedCiIsolation(update.path, current)), update.previousSha256);
		assert.equal(beforeManagedCiIsolation(update.path, current, update.currentSha256), current);
		for(const historicalBytes of [managedCiIsolationHistoricalBytes, nativeForkRepairHistoricalBytes, ownedDotnetHistoricalBytes, ownedRubyHistoricalBytes])
		{
			assert.equal(sha256(historicalBytes(update.path, Buffer.from(current), update.previousSha256)), update.previousSha256);
			assert.equal(sha256(historicalBytes(update.path, Buffer.from(current), update.currentSha256)), update.currentSha256);
		}
		const unknown = current + "\n/* unrecorded */\n";
		assert.equal(beforeManagedCiIsolation(update.path, unknown), unknown);
		assert.throws(() => reverseManagedCiIsolation(unknown, update));
		assert.throws(() => reverseManagedCiIsolation(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0xff, 0xfe, 0, 0x80]);
	for(const historicalBytes of [managedCiIsolationHistoricalBytes, nativeForkRepairHistoricalBytes, ownedDotnetHistoricalBytes, ownedRubyHistoricalBytes])
		assert.equal(historicalBytes("unrecorded.bin", binary), binary);
});
