/**
 * Close the optional successor and extension histories without rewriting either predecessor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforePhpCallbackInstalledStaging } from "./php-callback-installed-staging-history.mjs";
import { beforePostPerlCallbackStaging } from "./post-perl-callback-staging-history.mjs";
import { beforeCopiedFixtureReaders } from "./copied-fixture-source-history.mjs";
import { assertPerlVariantHistory, beforePerlCallbackVariants, readPerlVariantHistory
	, reversePerlVariantUpdate, perlVariantHistoryPath, perlVariantHistorySha256
	, perlVariantPredecessor } from "./owned-perl-callback-result-variant-history.mjs";

const variantClosureRevision
	= "fa51434d712136f38b6b0f88d9361494a32eda3a";
const anchoredSources = new Map();
const sourceAtAnchor = (path, expected, revisions) => {
	const key = JSON.stringify([path, expected, revisions]);
	if(anchoredSources.has(key)) return anchoredSources.get(key);
	for(const revision of revisions)
	{
		let source;
		try
		{
			source = execFileSync("git", ["show", `${revision}:${path}`], {
				encoding: "utf8", maxBuffer: 128 * 1024 * 1024
				, stdio: ["ignore", "pipe", "ignore"]
			});
		}
		catch
		{ continue; }
		if(sha256(source) !== expected) continue;
		anchoredSources.set(key, source);
		return source;
	}
	assert.fail(`${path} has no authenticated source at ${expected}`);
};

test("Perl optional history rejects altered chronology, open schemas and forged transitions", async t => {
	const history = readPerlVariantHistory();
	assert.equal(sha256(await readFile(perlVariantHistoryPath)), perlVariantHistorySha256);
	const mutations = [
		item => item.schemaVersion++, item => item.kind += "-forged"
		, item => item.extensionBaselineRevision = item.successorIntegrationRevision
		, item => item.successorBaselineRevision = item.extensionBaselineRevision
		, item => item.successorIntegrationRevision = item.successorBaselineRevision
		, item => item.baselineRevision = item.extensionBaselineRevision
		, item => item.integrationRevision = item.successorIntegrationRevision
		, item => item.lineage.reverse(), item => item.lineage.pop()
		, item => item.lineage.push(item.lineage[0])
		, item => item.previous.sha256 = "0".repeat(64)
		, item => item.predecessor.path += ".forged"
		, item => item.scope = { installed: true }
		, ...["successorUpdates", "extensionUpdates"].flatMap(category => [
			item => item[category].pop(), item => item[category].reverse()
			, item => item[category].push(item[category][0])
			, item => item[category][0].path = "unknown.mjs"
			, item => item[category][0].currentSha256 = "invalid"
			, item => item[category][0].previousSha256 = item[category][0].currentSha256
			, item => item[category][0].strategy = "replace-all"
			, item => item[category][0].extra = true
			, item => item[category][0].edits = []
			, item => item[category][0].edits[0].start = -1
			, item => item[category][0].edits[0].start = 0.5
			, item => item[category][0].edits[0].previous = item[category][0].edits[0].current
			, item => item[category][0].edits[0].extra = true
			, item => item[category][0].edits.push(item[category][0].edits[0])
		])
		, item => delete item.introducedSources[Object.keys(item.introducedSources)[0]]
		, item => item.introducedSources["extra.mjs"] = { sha256: "a".repeat(64) }
		, item => item.introducedSources[Object.keys(item.introducedSources)[0]].sha256 = "invalid"
		, item => item.extensionUpdates.find(value => value.path.endsWith("-ci.mjs")).previousSha256 = "a".repeat(64)
		, item => item.extensionUpdates.find(value => value.path.endsWith("-evidence-tests.mjs")).previousSha256 = "a".repeat(64)
	];
	for(const mutate of mutations)
	{
		const candidate = structuredClone(history); mutate(candidate);
		assert.notEqual(JSON.stringify(candidate), JSON.stringify(history), String(mutate));
		assert.throws(() => assertPerlVariantHistory(candidate), String(mutate));
	}
	t.diagnostic(`${mutations.length} closed history mutations rejected.`);
});

test("Perl optional history closes former exclusions and preserves exact stopping bytes", async t => {
	const history = readPerlVariantHistory(); let rejected = 0;
	const categories = ["extensionUpdates", "successorUpdates"];
	for(const category of categories) for(const update of history[category])
	{
		const revisions = category === "extensionUpdates"
			? [variantClosureRevision]
			: [...history.lineage, variantClosureRevision];
		const source = sourceAtAnchor(
			update.path, update.currentSha256, revisions
		);
		const current = beforePerlCallbackVariants(update.path, source, update.currentSha256);
		assert.equal(sha256(current), update.currentSha256);
		assert.equal(beforePhpCallbackInstalledStaging(
			update.path, current, update.currentSha256
		), current);
		const prior = reversePerlVariantUpdate(current, update, category);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforePerlCallbackVariants(update.path, current, update.currentSha256), current);
		assert.equal(beforePerlCallbackVariants(update.path, current, update.previousSha256), prior);
		const unknown = current + "\n";
		assert.equal(beforePerlCallbackVariants(update.path, unknown), unknown);
		assert.throws(() => reversePerlVariantUpdate(
			unknown, update, category
		)); rejected++;
		assert.equal(beforePerlCallbackVariants("unknown.mjs", current), current);
	}
	// The malformed-transition checks exercise category-specific validation.
	// One small authenticated member per category avoids repeating the same
	// generic assertions over the 43 MB inventory transition.
	for(const category of categories)
	{
		const update = history[category].find(item =>
			item.path !== "docs/type-surface.v1.json"
		);
		assert.ok(update);
		const revisions = category === "extensionUpdates"
			? [variantClosureRevision]
			: [...history.lineage, variantClosureRevision];
		const current = sourceAtAnchor(
			update.path, update.currentSha256, revisions
		);
		for(const unknown of [current + current, ""
			, Buffer.from([0, 255, 128])]){
			assert.equal(beforePerlCallbackVariants(
				update.path, unknown
			), unknown);
			assert.throws(() => reversePerlVariantUpdate(
				unknown, update, category
			)); rejected++;
			}
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }, { ...update, extra: true }
			, { ...update, edits: [{ ...update.edits[0], start: update.edits[0].start + 1 }] }]) {
			assert.throws(() => reversePerlVariantUpdate(current, changed, category)); rejected++;
			}
		assert.throws(() => reversePerlVariantUpdate(current, update, category === "extensionUpdates" ? "successorUpdates" : "extensionUpdates")); rejected++;
	}
	const predecessor = JSON.parse(await readFile(perlVariantPredecessor.path));
	for(const update of history.successorUpdates)
	{
		const current = await readFile(update.path), expected = predecessor.sources[update.path];
		assert.ok(expected, update.path);
		assert.equal(sha256(beforePostPerlCallbackStaging(update.path, current, expected)), expected, update.path);
		assert.equal(sha256(beforeCopiedFixtureReaders(update.path, current, expected)), expected, update.path);
	}
	for(const [path, identity] of Object.entries(history.introducedSources))
	{
		const source = sourceAtAnchor(
			path, identity.sha256, history.lineage
		);
		assert.equal(sha256(beforePerlCallbackVariants(path, source, identity.sha256)), identity.sha256, path);
	}
	const inventoryUpdate = history.extensionUpdates.find(value => value.path === "docs/type-surface.v1.json");
	const inventoryBytes = sourceAtAnchor(
		inventoryUpdate.path, inventoryUpdate.currentSha256
		, [variantClosureRevision]
	);
	const inventory = JSON.parse(inventoryBytes);
	const previous = JSON.parse(reversePerlVariantUpdate(inventoryBytes, inventoryUpdate, "extensionUpdates"));
	const allowed = new Map([["package.json", 18]
		, ["src/adoption/test-profiles.mjs", 93]
		, ["src/build/native-project.mjs", 75]
		, [".github/workflows/consumer-matrix.yml", 89]
		, ["src/build/multi-profile-project.mjs", 7]
		, ["docs/consume/perl.md", 1]]);
	const refreshed = new Map([...allowed.keys()].map(path => [path, 0]));
	for(const [index, evidence] of inventory.evidence.entries()) for(const [fileIndex, file] of evidence.files.entries())
	{
		const prior = previous.evidence[index].files[fileIndex];
		if(file.sha256 !== prior.sha256)
		{
			assert.ok(allowed.has(file.path), file.path);
			assert.equal(file.sha256, sha256(sourceAtAnchor(
				file.path, file.sha256
				, [...history.lineage, variantClosureRevision]
			)));
			file.sha256 = prior.sha256; refreshed.set(file.path, refreshed.get(file.path) + 1);
		}
	}
	assert.deepEqual(refreshed, allowed);
	assert.equal(JSON.stringify(inventory), JSON.stringify(previous)
		, "No inventory cell, state or version promotion");
	const version = `"contractVersion": "${inventory.contractVersion}"`;
	const bytes = inventoryBytes.replace(
		version, `"contractVersion": "${inventory.contractVersion}-forged"`
	);
	assert.notEqual(bytes, inventoryBytes);
	assert.notEqual(sha256(bytes), inventoryUpdate.currentSha256);
	assert.equal(beforePerlCallbackVariants(inventoryUpdate.path, bytes), bytes);
	assert.equal(beforePostPerlCallbackStaging(inventoryUpdate.path, bytes), bytes);
	assert.throws(() => reversePerlVariantUpdate(
		bytes, inventoryUpdate, "extensionUpdates"
	)); rejected++;
	assert.equal(rejected, 40);
	t.diagnostic(`19 exact transitions, 3 introduced readers and ${rejected} rejected byte/transition forgeries.`);
});
