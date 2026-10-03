/**
 * Verify the closed native-PHP callback acceptance chronology and boundaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertPhpCallbackAcceptanceHistory, beforePhpCallbackAcceptance
	, phpCallbackAcceptanceHistoryPath, phpCallbackAcceptanceHistorySha256
	, phpCallbackAcceptanceIntegrationModifiedPaths, phpCallbackAcceptanceReaderPaths
	, phpCallbackAcceptanceReceipt
	, readPhpCallbackAcceptanceHistory, reversePhpCallbackAcceptanceUpdate
} from "./php-callback-acceptance-history.mjs";

test("PHP callback acceptance history rejects altered chronology, scope and schemas", async t => {
	const history = readPhpCallbackAcceptanceHistory(), mutations = [
		value => { value.schemaVersion++; }
		, value => { value.kind += "-forged"; }
		, value => { value.baselineRevision = value.integrationRevision; }
		, value => { value.integrationRevision = value.baselineRevision; }
		, value => { value.lineage.reverse(); }
		, value => { value.lineage.pop(); }
		, value => { value.previous.sha256 = "0".repeat(64); }
		, value => { value.completedReceipt.path += ".forged"; }
		, value => { value.scope.acceptanceReceipt = false; }
		, value => { value.scope.supportPromotions = 1; }
		, value => { value.updates.pop(); }
		, value => { value.updates.reverse(); }
		, value => { value.updates.push(value.updates[0]); }
		, value => { value.updates[0].category = "runtime"; }
		, value => { value.updates[0].currentSha256 = "invalid"; }
		, value => { value.updates[0].previousSha256 = value.updates[0].currentSha256; }
		, value => { value.updates[0].edits = []; }
		, value => { value.readerUpdates.pop(); }
		, value => { value.readerUpdates.reverse(); }
		, value => { delete value.introducedSources[Object.keys(value.introducedSources)[0]]; }
		, value => { value.introducedSources[Object.keys(value.introducedSources)[0]].currentSha256 = "0".repeat(64); }
		, value => { value.extra = true; }
	];
	for(const mutate of mutations)
	{
		const candidate = structuredClone(history); mutate(candidate);
		assert.notDeepEqual(candidate, history); assert.throws(() => assertPhpCallbackAcceptanceHistory(candidate));
	}
	t.diagnostic(`${mutations.length} closed PHP acceptance history forgeries rejected`);
});

test("PHP callback acceptance history reverses exact sources and preserves unknown bytes", async t => {
	const bytes = await readFile(phpCallbackAcceptanceHistoryPath);
	assert.equal(sha256(bytes), phpCallbackAcceptanceHistorySha256);
	const history = readPhpCallbackAcceptanceHistory();
	assert.deepEqual(history.updates.map(update => update.path), phpCallbackAcceptanceIntegrationModifiedPaths);
	assert.deepEqual(history.readerUpdates.map(update => update.path), phpCallbackAcceptanceReaderPaths);
	let rejected = 0;
	for(const category of ["readerUpdates", "updates"]) for(const update of history[category])
	{
		const current = await readFile(update.path);
		const source = category === "readerUpdates" ? current
			: Buffer.from(beforePhpCallbackAcceptance(update.path, current, update.currentSha256));
		const previous = beforePhpCallbackAcceptance(update.path, source, update.previousSha256);
		assert.equal(sha256(source), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(beforePhpCallbackAcceptance(update.path, source, update.currentSha256), source);
		assert.equal(beforePhpCallbackAcceptance(update.path, previous, update.previousSha256), previous);
		for(const unknown of [Buffer.concat([source, Buffer.from("\n")]), Buffer.from(""), Buffer.from([0, 255, 128])])
		{
			assert.equal(beforePhpCallbackAcceptance(update.path, unknown), unknown);
			assert.throws(() => reversePhpCallbackAcceptanceUpdate(unknown, update, category)); rejected++;
		}
		for(const changed of [{ ...update, path: "unknown.mjs" }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, extra: true }
		]) {
			assert.throws(() => reversePhpCallbackAcceptanceUpdate(source, changed, category)); rejected++;
		}
	}
	t.diagnostic(`${history.updates.length + history.readerUpdates.length} exact transitions and ${rejected} rejected source forgeries`);
});

test("PHP callback acceptance history preserves the receipt without promoting support", async () => {
	const history = readPhpCallbackAcceptanceHistory();
	assert.equal(sha256(await readFile(phpCallbackAcceptanceReceipt.path)), phpCallbackAcceptanceReceipt.sha256);
	assert.deepEqual(history.scope, { stage: "native-php-callback-acceptance"
		, acceptanceReceipt: true, ciRequired: true, documentationPublished: true
		, producerRerun: true, registryPublication: false, supportPromotions: 0 });
	for(const [path, identity] of Object.entries(history.introducedSources))
	{
		assert.equal(sha256(await readFile(path)), identity.currentSha256, path);
		const sourceUpdate = [...history.readerUpdates, ...history.updates]
			.find(value => value.path === path);
		assert.equal(identity.integrationSha256
			, sourceUpdate?.previousSha256 ?? identity.currentSha256, path);
	}
	const update = history.updates.find(value => value.path === "docs/type-surface.v1.json");
	const current = JSON.parse(await readFile(update.path, "utf8"));
	const previous = JSON.parse(beforePhpCallbackAcceptance(update.path
		, JSON.stringify(current, null, 2) + "\n"));
	for(const evidence of current.evidence) for(const file of evidence.files)
	{
		const prior = previous.evidence.find(item => item.id === evidence.id);
		const priorFile = prior.files.find(item => item.path === file.path);
		file.sha256 = priorFile.sha256;
	}
	assert.deepEqual(current, previous, "Only authenticated source identities changed in the inventory");
});
