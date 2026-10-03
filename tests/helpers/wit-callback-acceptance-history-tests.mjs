/**
 * Prove the direct-WIT callback receipt's source chronology is reversible.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedWitCallbackAcceptance, ownedWitCallbackEvidencePath } from "./owned-wit-callback-result-acceptance.mjs";
import { beforeWitCallbackInstalledAcceptance } from "./wit-callback-installed-acceptance-history.mjs";
import { assertWitCallbackAcceptanceHistory, beforeWitCallbackAcceptance
	, readWitCallbackAcceptanceHistory, reverseWitCallbackAcceptanceUpdate
	, witCallbackAcceptanceIntroducedPaths } from "./wit-callback-acceptance-history.mjs";

test("WIT callback acceptance history closes integration, readers and introduced sources", () => {
	const history = readWitCallbackAcceptanceHistory(), mutations = [
		item => { item.schemaVersion++; }, item => { item.kind += "-forged"; }
		, item => { item.baselineRevision = "0".repeat(40); }
		, item => { item.integrationRevision = "0".repeat(40); }
		, item => { item.completedReceipt.sha256 = "0".repeat(64); }
		, item => { item.scope.installedPackage = true; }
		, item => { item.updates[0].strategy = "forged"; }
		, item => { item.readerUpdates[0].edits = []; }
		, item => { delete item.introducedSources[witCallbackAcceptanceIntroducedPaths[0]]; }
	];
	let rejected = 0;
	for(const mutation of mutations)
	{
		const changed = structuredClone(history); mutation(changed);
		assert.throws(() => assertWitCallbackAcceptanceHistory(changed)); rejected++;
	}
	assert.equal(rejected, 9);
});

test("WIT callback acceptance history reconstructs baseline and receipt identities", async () => {
	const history = readWitCallbackAcceptanceHistory();
	for(const update of history.updates)
	{
		const integrated = beforeWitCallbackAcceptance(update.path
			, await readFile(update.path), update.currentSha256);
		assert.equal(sha256(integrated), update.currentSha256);
		const previous = reverseWitCallbackAcceptanceUpdate(integrated, update);
		assert.equal(sha256(previous), update.previousSha256);
	}
	for(const update of history.readerUpdates)
	{
		const current = beforeWitCallbackInstalledAcceptance(update.path
			, await readFile(update.path), update.currentSha256);
		assert.equal(sha256(current), update.currentSha256);
		assert.equal(sha256(beforeWitCallbackAcceptance(update.path, current, update.previousSha256))
			, update.previousSha256);
	}
	for(const [path, identity] of Object.entries(history.introducedSources))
	{
		const current = await readFile(path);
		assert.equal(sha256(beforeWitCallbackInstalledAcceptance(path
			, current, identity.currentSha256)), identity.currentSha256);
		assert.equal(sha256(beforeWitCallbackAcceptance(path
			, current, identity.integrationSha256)), identity.integrationSha256);
	}
	await assertOwnedWitCallbackAcceptance(JSON.parse(await readFile(ownedWitCallbackEvidencePath)));
});

test("WIT callback acceptance history preserves unknown successor bytes", async () => {
	const path = "package.json", current = await readFile(path);
	const unknown = Buffer.concat([current, Buffer.from("\n")]);
	assert.equal(beforeWitCallbackAcceptance(path, unknown), unknown);
});
