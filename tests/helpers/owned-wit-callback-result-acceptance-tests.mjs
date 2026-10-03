/**
 * Reject forged direct-WIT callback acceptance receipts without build output.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { packOwnedCallbackReports, unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedWitCallbackAcceptance, ownedWitCallbackCounts
	, ownedWitCallbackEvidencePath, ownedWitCallbackScope
	, ownedWitCallbackSourcePaths } from "./owned-wit-callback-result-acceptance.mjs";

const receipt = async () => JSON.parse(await readFile(ownedWitCallbackEvidencePath, "utf8"));
const zero = "0".repeat(64);

test("WIT callback acceptance freezes six direct Lean and Wasmtime executions", async () => {
	const record = await receipt(); await assertOwnedWitCallbackAcceptance(record);
	assert.deepEqual(record.scope, ownedWitCallbackScope);
	assert.deepEqual(record.scope.counts, ownedWitCallbackCounts);
	assert.deepEqual(Object.keys(record.sources), await ownedWitCallbackSourcePaths());
	assert.equal(Object.keys(record.archive.reports).length, 6);
	assert.equal(Object.keys(record.logs).length, 3);
});

test("WIT callback acceptance rejects receipt, source, report and TAP forgeries", async t => {
	const original = await receipt(), reportName = Object.keys(original.archive.reports)[0];
	const source = Object.keys(original.sources)[0], log = Object.keys(original.logs)[0];
	const mutations = [
		item => { item.schemaVersion++; }, item => { item.kind += "-forged"; }
		, item => { item.planNode++; }, item => { item.acceptance = "pending"; }
		, item => { item.baselineRevision = "0".repeat(40); }
		, item => { item.previous.sha256 = zero; }
		, item => { item.sourceHistory.sha256 = zero; }
		, item => { item.scope.actualLean = false; }
		, item => { item.scope.installedPackage = true; }
		, item => { item.sources[source] = zero; }
		, item => { delete item.sources[source]; }
		, item => { item.sources["unrecorded.mjs"] = zero; }
		, item => { item.logs[log] += "\n"; }, item => { delete item.logs[log]; }
		, item => { item.verification.exitCode = 1; }
		, item => { item.verification.text = item.verification.text.replace("# pass 4", "# pass 3");
			item.verification.sha256 = zero; }
		, item => { item.archive.reports[reportName].sha256 = zero; }
		, item => { delete item.archive.reports[reportName]; }
		, item => { item.archive.reports["extra.json"] = item.archive.reports[reportName]; }
	];
	let rejected = 0;
	for(const mutation of mutations)
	{
		const changed = structuredClone(original); mutation(changed);
		await assert.rejects(assertOwnedWitCallbackAcceptance(changed)); rejected++;
	}
	const reports = unpackOwnedCallbackReports(original.archive);
	reports[reportName].result.checks++;
	const changed = structuredClone(original); changed.archive = packOwnedCallbackReports(reports);
	await assert.rejects(assertOwnedWitCallbackAcceptance(changed)); rejected++;
	assert.equal(rejected, 20); t.diagnostic(`${rejected} frozen WIT receipt forgeries rejected`);
});
