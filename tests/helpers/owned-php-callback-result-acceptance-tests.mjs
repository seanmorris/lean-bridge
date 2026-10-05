/**
 * Reject forged native-PHP callback acceptance receipts without build handoffs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { packOwnedCallbackReports, unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedPhpCallbackAcceptance, ownedPhpCallbackCounts
	, ownedPhpCallbackEvidencePath, ownedPhpCallbackPrevious
	, ownedPhpCallbackScope, ownedPhpCallbackSourcePaths } from "./owned-php-callback-result-acceptance.mjs";

const receipt = async () => JSON.parse(await readFile(ownedPhpCallbackEvidencePath, "utf8"));
const zero = "0".repeat(64);

test("native PHP callback acceptance freezes direct runtime and six installed package matrices", async () => {
	const record = await receipt(); await assertOwnedPhpCallbackAcceptance(record);
	assert.deepEqual(record.previous, ownedPhpCallbackPrevious);
	assert.deepEqual(record.scope, ownedPhpCallbackScope);
	assert.deepEqual(record.scope.counts, ownedPhpCallbackCounts);
	assert.deepEqual(Object.keys(record.sources), await ownedPhpCallbackSourcePaths());
	assert.equal(Object.keys(record.archive.reports).length, 6);
	assert.equal(Object.keys(record.handoffs).length, 6);
	assert.equal(Object.keys(record.logs).length, 6);
});

test("native PHP callback acceptance rejects receipt, source, log and handoff forgeries", async t => {
	const original = await receipt(), first = Object.keys(original.archive.reports)[0];
	const source = Object.keys(original.sources)[0];
	const mutations = [
		item => { item.schemaVersion++; }
		, item => { item.kind += "-forged"; }
		, item => { item.planNode++; }
		, item => { item.acceptance = "pending"; }
		, item => { item.baselineRevision = "0".repeat(40); }
		, item => { item.previous.sha256 = zero; }
		, item => { item.previous.path += ".forged"; }
		, item => { item.sourceHistory.sha256 = zero; }
		, item => { item.sourceHistory.path += ".forged"; }
		, item => { item.runtimeEvidence.sha256 = zero; }
		, item => { item.runtimeEvidence.path += ".forged"; }
		, item => { item.sources[source] = zero; }
		, item => { delete item.sources[source]; }
		, item => { item.sources["unrecorded.mjs"] = zero; }
		, item => { item.logs[first] += "\n"; }
		, item => { delete item.logs[first]; }
		, item => { item.logs["unrecorded.json"] = item.logs[first]; }
		, item => { item.verification.exitCode = 1; }
		, item => { item.verification.command = "node unrelated.mjs"; }
		, item => { item.verification.sha256 = zero; }
		, item => { item.verification.extra = true; }
		, item => { item.handoffs[first].original.receipt.sha256 = zero; }
		, item => { item.handoffs[first].original.archive.bytes++; }
		, item => { item.handoffs[first].independent.root = item.handoffs[first].original.root; }
		, item => { delete item.handoffs[first]; }
		, item => { item.handoffs["unrecorded.json"] = item.handoffs[first]; }
		, item => { item.archive.format += "-forged"; }
		, item => { item.archive.extra = true; }
		, item => { item.archive.reports[first].sha256 = zero; }
		, item => { item.archive.reports[first].bytes++; }
		, item => { delete item.archive.reports[first]; }
		, item => { item.archive.nodes[zero] = { forged: true }; }
		, item => { item.extraClaim = true; }
	];
	for(const [name, value] of Object.entries(ownedPhpCallbackScope)) mutations.push(item => {
		item.scope[name] = typeof value === "boolean" ? !value : typeof value === "number" ? value + 1 : null;
	});
	for(const change of [
		text => text.replace("# pass 3", "# pass 2")
		, text => text.replace("# fail 0", "# fail 1")
		, text => text.replace("ok 1 -", "not ok 1 -")
		, text => text.replace("1..3", "1..2")
		, text => text.replace("3344 public checks", "3343 public checks")
		, text => text.replace("692 changed", "691 changed")
		, text => text.replace("173 terminal", "172 terminal")
		, text => text + "extra output\n"
	]) mutations.push(item => {
		const text = change(item.verification.text); item.verification.text = text;
		item.verification.sha256 = sha256(text);
	});
	let rejected = 0;
	for(const [index, mutate] of mutations.entries())
	{
		const candidate = structuredClone(original); await mutate(candidate);
		assert.notEqual(JSON.stringify(candidate), JSON.stringify(original));
		await assert.rejects(() => assertOwnedPhpCallbackAcceptance(candidate), undefined, `receipt mutation ${index}`); rejected++;
	}
	const reports = unpackOwnedCallbackReports(original.archive);
	for(const mutate of [
		item => { item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary"; }
		, item => { item.observations[0].observed.resultSlots = 1; }
		, item => { item.producerExecutions[0].code = 1; }
	]) {
		const candidate = structuredClone(original), changed = unpackOwnedCallbackReports(candidate.archive);
		mutate(changed[first]); candidate.archive = packOwnedCallbackReports(changed);
		candidate.handoffs[first] = structuredClone(original.handoffs[first]);
		assert.notDeepEqual(changed[first], reports[first]);
		await assert.rejects(() => assertOwnedPhpCallbackAcceptance(candidate)); rejected++;
	}
	t.diagnostic(`${rejected} frozen PHP receipt forgeries rejected without retained build handoffs.`);
});
