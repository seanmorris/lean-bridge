/**
 * Reject forged native fork outcomes and unrecorded source normalization.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertNativeForkRepair } from "./helpers/native-fork-repair-evidence.mjs";
import { beforeNativeForkRepair, nativeForkRepairHistoricalBytes, nativeForkRepairPath, reverseNativeForkRepair } from "./helpers/native-fork-repair-history.mjs";
import { ownedDotnetHistoricalBytes, ownedDotnetNormalizationPaths } from "./helpers/owned-dotnet-source-history.mjs";
import { ownedRubyHistoricalBytes } from "./helpers/owned-ruby-source-history.mjs";
import { beforeManagedCiIsolation } from "./helpers/managed-ci-isolation-history.mjs";

const receipt = async () => JSON.parse(await readFile(nativeForkRepairPath, "utf8"));

test("native fork regression repair authenticates fresh callers and immutable predecessors", async () => {
	await assertNativeForkRepair(await receipt());
});

test("native fork repair evidence rejects changed statuses, execution and source history", async () => {
	const original = await receipt();
	for(const change of [
		record => { record.scope.expectedChildStatus = "NG_INVALID"; }
		, record => { record.scope.generalForkSupport = true; }
		, record => { record.scope.unchangedOutput = false; }
		, record => { record.scope.productionChanged = true; }
		, record => { record.scope.installedPackageClaim = true; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { delete record.sources["tests/helpers/native-recursive-callable-calls-probe.mjs"]; }
		, record => { record.updates[0].previousSha256 = "0".repeat(64); }
		, record => { record.updates[0].edits[0].previous += "unrecorded"; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import substitute.mjs"; }
		, record => { record.run.text = record.run.text.replace("# fail 0", "# fail 1"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.transport.reports.pop(); }
		, record => { record.transport.reports[0].calls.result.checks--; }
		, record => { record.transport.reports[1].calls.sanitized.rejections--; }
		, record => { record.transport.reports[0].calls.retirementChecks.pop(); }
		, record => { record.transport.reports[0].calls.rejectedMutations.pop(); }
		, record => { record.transport.reports[0].calls.sourceSha256 = "0".repeat(64); }
		, record => { record.transport.reports[0].initializer = "initialize_wrong"; }
		, record => { record.transport.reports[1].bindingIrSha256 = "0".repeat(64); }
		, record => { record.inventory.promoted = 1; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertNativeForkRepair(changed, false), change.toString());
	}
});

test("native fork repair history preserves unknown files and authenticates complete transitions", async () => {
	for(const update of (await receipt()).updates)
	{
		const current = beforeManagedCiIsolation(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		assert.equal(sha256(beforeNativeForkRepair(update.path, current)), update.previousSha256);
		assert.equal(beforeNativeForkRepair(update.path, current, update.currentSha256), current);
		assert.ok(ownedDotnetNormalizationPaths.includes(update.path));
		for(const historicalBytes of [nativeForkRepairHistoricalBytes, ownedDotnetHistoricalBytes, ownedRubyHistoricalBytes])
		{
			assert.equal(sha256(historicalBytes(update.path, Buffer.from(current), update.previousSha256)), update.previousSha256);
			assert.equal(sha256(historicalBytes(update.path, Buffer.from(current), update.currentSha256)), update.currentSha256);
		}
		const unknown = current + "\n/* unrecorded */\n";
		assert.equal(beforeNativeForkRepair(update.path, unknown), unknown);
		assert.throws(() => reverseNativeForkRepair(unknown, update));
		assert.throws(() => reverseNativeForkRepair(current, { ...update, edits: [...update.edits, update.edits[0]] }));
		assert.throws(() => reverseNativeForkRepair(current, { ...update, path: "unrecorded.txt" }));
	}
	const binary = Buffer.from([0xff, 0xfe, 0, 0x80]);
	for(const historicalBytes of [nativeForkRepairHistoricalBytes, ownedDotnetHistoricalBytes, ownedRubyHistoricalBytes])
		assert.equal(historicalBytes("unrecorded.bin", binary), binary);
});
