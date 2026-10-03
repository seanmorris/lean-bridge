/**
 * Verify the closed PHP installed-package staging transition and its boundaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertPerlVariantAcceptance, perlVariantEvidencePath } from "./owned-perl-callback-result-variant-acceptance.mjs";
import { assertPhpCallbackInstalledHistory, beforePhpCallbackInstalledStaging
	, phpCallbackInstalledChangedPaths, phpCallbackInstalledHistoryPath
	, phpCallbackInstalledHistorySha256, readPhpCallbackInstalledHistory
	, reversePhpCallbackInstalledUpdate } from "./php-callback-installed-staging-history.mjs";

test("PHP installed callback history rejects forged chronology, scope and schemas", async t => {
	const history = readPhpCallbackInstalledHistory(), mutations = [
		value => { value.schemaVersion++; }, value => { value.kind += "-forged"; }
		, value => { value.baselineRevision = value.integrationRevision; }
		, value => { value.integrationRevision = value.lineage[0]; }
		, value => { value.lineage.reverse(); }, value => { value.lineage.pop(); }
		, value => { value.previous.sha256 = "0".repeat(64); }
		, value => { value.completedPredecessor.path += ".forged"; }
		, value => { value.scope.acceptanceReceipt = true; }
		, value => { value.scope.supportPromotions = 1; }
		, value => { value.updates.pop(); }, value => { value.updates.reverse(); }
		, value => { value.updates.push(value.updates[0]); }
		, value => { value.updates[0].category = "runtime"; }
		, value => { value.updates[0].currentSha256 = "invalid"; }
		, value => { value.updates[0].previousSha256 = value.updates[0].currentSha256; }
		, value => { value.updates[0].strategy = "spans"; }
		, value => { value.updates[0].edits[0].count = 0; }
		, value => { value.updates[1].addedTests.pop(); }
		, value => { delete value.introducedSources[Object.keys(value.introducedSources)[0]]; }
		, value => { value.introducedSources[Object.keys(value.introducedSources)[0]].stagedSha256 = "0".repeat(64); }
		, value => { value.extra = true; }
	];
	for(const mutate of mutations)
	{
		const candidate = structuredClone(history); mutate(candidate);
		assert.notDeepEqual(candidate, history); assert.throws(() => assertPhpCallbackInstalledHistory(candidate));
	}
	t.diagnostic(`${mutations.length} closed-history forgeries rejected`);
});

test("PHP installed callback staging reverses exact sources and rejects drift", async t => {
	const bytes = await readFile(phpCallbackInstalledHistoryPath);
	assert.equal(sha256(bytes), phpCallbackInstalledHistorySha256);
	const history = readPhpCallbackInstalledHistory(); assertPhpCallbackInstalledHistory(history);
	assert.deepEqual(history.updates.map(update => update.path), phpCallbackInstalledChangedPaths);
	let rejected = 0;
	for(const update of history.updates)
	{
		const current = await readFile(update.path), previous = beforePhpCallbackInstalledStaging(update.path, current);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(beforePhpCallbackInstalledStaging(update.path, current, update.currentSha256), current);
		assert.equal(beforePhpCallbackInstalledStaging(update.path, previous), previous);
		for(const unknown of [Buffer.concat([current, Buffer.from("\n")]), Buffer.from(""), Buffer.from([0, 255, 128, 192])])
		{
			assert.equal(beforePhpCallbackInstalledStaging(update.path, unknown), unknown);
			assert.throws(() => reversePhpCallbackInstalledUpdate(unknown, update)); rejected++;
		}
		for(const changed of [{ ...update, path: "unknown.mjs" }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, category: update.category === "reader" ? "administrative" : "reader" }
			, { ...update, extra: true }
		]) {
			assert.throws(() => reversePhpCallbackInstalledUpdate(current, changed)); rejected++;
		}
	}
	for(const [path, identity] of Object.entries(history.introducedSources))
	{
		assert.equal(sha256(await readFile(path)), identity.stagedSha256, path);
		const update = history.updates.find(value => value.path === path);
		assert.equal(identity.integrationSha256, update?.previousSha256 ?? identity.stagedSha256, path);
	}
	assert.equal(beforePhpCallbackInstalledStaging("unknown.mjs", bytes), bytes);
	t.diagnostic(`${history.updates.length} exact updates, ${Object.keys(history.introducedSources).length} introduced sources, ${rejected} rejected source forgeries`);
});

test("PHP staging registers two tests without changing type-surface support", async () => {
	const history = readPhpCallbackInstalledHistory();
	const registration = history.updates.find(update => update.strategy === "registrations");
	assert.deepEqual(registration.addedTests, [
		"owned-php-callback-result-package-evidence"
		, "owned-php-callback-result-packaging"
	]);
	const inventoryUpdate = history.updates.find(update => update.path === "docs/type-surface.v1.json");
	const current = await readFile(inventoryUpdate.path, "utf8");
	const previous = beforePhpCallbackInstalledStaging(inventoryUpdate.path, current);
	const currentInventory = JSON.parse(current), previousInventory = JSON.parse(previous);
	const refreshes = new Map(inventoryUpdate.edits.map(edit => [edit.path, edit]));
	for(const evidence of currentInventory.evidence) for(const file of evidence.files)
		if(refreshes.has(file.path))
		{
			const edit = refreshes.get(file.path); assert.equal(file.sha256, edit.current);
			file.sha256 = edit.previous;
		}
	assert.deepEqual(currentInventory, previousInventory);
	assert.deepEqual(history.scope, { stage: "installed-package-evidence"
		, acceptanceReceipt: false
		, ciRequired: false, documentationPublished: false, producerRerun: false
		, registryPublication: false, supportPromotions: 0 });
});

test("PHP staging preserves the immutable optional Perl package acceptance", async () => {
	const record = JSON.parse(await readFile(perlVariantEvidencePath, "utf8"));
	await assertPerlVariantAcceptance(record);
});
