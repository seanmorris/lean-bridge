/**
 * Reject broadened fork claims and forged cold-loader or predecessor evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedDotnetProcess } from "./helpers/owned-dotnet-process-evidence.mjs";
import { ownedDotnetHistoricalBytes, ownedDotnetNormalizationPaths } from "./helpers/owned-dotnet-source-history.mjs";
import { ownedRubyHistoricalBytes } from "./helpers/owned-ruby-source-history.mjs";
import { beforeOwnedDotnetProcess, ownedDotnetProcessHistoricalBytes, ownedDotnetProcessPath, reverseOwnedDotnetProcess } from "./helpers/owned-dotnet-process-history.mjs";

const receipt = async () => JSON.parse(await readFile(ownedDotnetProcessPath, "utf8"));

test("C# process-origin hardening binds installed peers, cold probes and original receipts", async () => {
	await assertOwnedDotnetProcess(await receipt());
});

test("C# process-origin evidence rejects missing cold guards and forged predecessors", async () => {
	const original = await receipt();
	for(const change of [
		record => { record.scope.generalClrForkSupport = true; }
		, record => { record.scope.defaultClrProtections = false; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { delete record.sources["src/backends/dotnet/verified-assets.mjs"]; }
		, record => { record.updates[0].previousSha256 = "0".repeat(64); }
		, record => { record.generatedUpdates.pop(); }
		, record => { record.generatedUpdates[0].edits[0].previous += "changed"; }
		, record => { record.runs.coexistence.exitCode = 1; }
		, record => { record.runs.packages.command += " --import substitute.mjs"; }
		, record => { record.coexistence.coldLoading.observations.pop(); }
		, record => { record.coexistence.coldLoading.observations[0].coldInParent = false; }
		, record => { record.coexistence.coldLoading.observations[2].installedOrigin = false; }
		, record => { record.coexistence.coldLoading.observations[4].registryLockHeld = false; }
		, record => { record.coexistence.coldLoading.observations[1].childExit = 0; }
		, record => { record.coexistence.coldLoading.observations[0].defaultClrProtections = false; }
		, record => { record.coexistence.coldLoading.variants[1].loaderSha256 = "0".repeat(64); }
		, record => { record.coexistence.coldLoading.variants[0].projectSha256 = "0".repeat(64); }
		, record => { record.coexistence.coldLoading.evidence.componentReceiptSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.sourceFreeRelocatedExecution = false; }
		, record => { record.scalarPackages.ordinary.observation.checks--; }
		, record => { record.regressions.recursive.mixedReports.pop(); }
		, record => { record.inventory.promoted = 1; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedDotnetProcess(changed, false), change.toString());
	}
});

test("C# process-origin history accepts only exact whole-file transitions", async () => {
	for(const update of (await receipt()).updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(beforeOwnedDotnetProcess(update.path, current)), update.previousSha256);
		assert.equal(beforeOwnedDotnetProcess(update.path, current, update.currentSha256), current);
		assert.ok(ownedDotnetNormalizationPaths.includes(update.path));
		for(const historicalBytes of [ownedDotnetHistoricalBytes, ownedRubyHistoricalBytes])
		{
			assert.equal(sha256(historicalBytes(update.path, Buffer.from(current), update.previousSha256)), update.previousSha256);
			assert.equal(sha256(historicalBytes(update.path, Buffer.from(current), update.currentSha256)), update.currentSha256);
		}
		const unknown = current + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedDotnetProcess(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedDotnetProcess(unknown, update));
		assert.throws(() => reverseOwnedDotnetProcess(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0xff, 0xfe, 0, 0x80]);
	assert.equal(ownedDotnetProcessHistoricalBytes("unrecorded.bin", binary), binary);
	assert.equal(ownedDotnetHistoricalBytes("unrecorded.bin", binary), binary);
	assert.equal(ownedRubyHistoricalBytes("unrecorded.bin", binary), binary);
});
