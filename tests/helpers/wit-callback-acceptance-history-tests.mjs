/**
 * Prove the direct-WIT callback receipt's source chronology is reversible.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedWitCallbackAcceptance, ownedWitCallbackEvidencePath } from "./owned-wit-callback-result-acceptance.mjs";
import { assertWitCallbackAcceptanceHistory, beforeWitCallbackAcceptance
	, readWitCallbackAcceptanceHistory, reverseWitCallbackAcceptanceUpdate
	, witCallbackAcceptanceBaseline, witCallbackAcceptanceIntegration
	, witCallbackAcceptanceIntroducedPaths } from "./wit-callback-acceptance-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const at = (revision, path) => git(["show", `${revision}:${path}`]);

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
		const integrated = at(witCallbackAcceptanceIntegration, update.path);
		assert.equal(sha256(integrated), update.currentSha256);
		assert.equal(sha256(reverseWitCallbackAcceptanceUpdate(integrated, update)), update.previousSha256);
		assert.equal(update.previousSha256, sha256(at(witCallbackAcceptanceBaseline, update.path)));
	}
	for(const update of history.readerUpdates)
	{
		const current = await readFile(update.path);
		assert.equal(sha256(current), update.currentSha256);
		assert.equal(sha256(beforeWitCallbackAcceptance(update.path, current, update.previousSha256))
			, update.previousSha256);
	}
	for(const [path, identity] of Object.entries(history.introducedSources))
	{
		assert.equal(sha256(at(witCallbackAcceptanceIntegration, path)), identity.integrationSha256);
		assert.equal(sha256(await readFile(path)), identity.currentSha256);
	}
	await assertOwnedWitCallbackAcceptance(JSON.parse(await readFile(ownedWitCallbackEvidencePath)));
});

test("WIT callback acceptance history preserves unknown successor bytes", async () => {
	const path = "package.json", current = await readFile(path);
	const unknown = Buffer.concat([current, Buffer.from("\n")]);
	assert.equal(beforeWitCallbackAcceptance(path, unknown), unknown);
});
