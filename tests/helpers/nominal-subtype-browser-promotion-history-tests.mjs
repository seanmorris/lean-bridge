/**
 * Verify the standalone nominal browser promotion preserves all earlier source and support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sourceAtHistoryMilestone, withHistoryMilestoneSourcePins } from "./source-history-test-source.mjs";
import { nominalSubtypeBrowserReferences, promoteNominalSubtypeBrowser } from "./nominal-subtype-browser-promotion.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { beforeNominalSubtypePhpWasmPromotionPins } from "./nominal-subtype-php-wasm-promotion-history.mjs";
import { beforeNominalSubtypeBrowserPromotionSource, nominalSubtypeBrowserPromotionChangedPaths, nominalSubtypeBrowserPromotionHistoryPath, nominalSubtypeBrowserPromotionPredecessor, reverseNominalSubtypeBrowserPromotionUpdate } from "./nominal-subtype-browser-promotion-history.mjs";

test("nominal browser promotion history authenticates exact changes and the eighteen observed browser cells", async t => {
	const record = JSON.parse(await readFile(nominalSubtypeBrowserPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-browser-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypeBrowserPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypeBrowserPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypeBrowserPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nominalSubtypeBrowserPromotionHistoryPath, update.path
		);
		const previous = reverseNominalSubtypeBrowserPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypeBrowserPromotionSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypeBrowserPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypeBrowserPromotionSource(update.path, previous), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeNominalSubtypeBrowserPromotionSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypeBrowserPromotionUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = beforeNominalSubtypePhpWasmPromotionPins(await promoteNominalSubtypeBrowser(JSON.parse(original(inventoryPath)), await nominalSubtypeBrowserReferences()));
	assert.equal(beforeNominalSubtypeBrowserPromotionSource(inventoryPath, await sourceAtHistoryMilestone(nominalSubtypeBrowserPromotionHistoryPath, inventoryPath)), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	const inventoryUpdate = record.updates.find(update => update.path === inventoryPath);
	const checkpoint = beforeNominalSubtypeBrowserPromotionSource(inventoryPath, await sourceAtHistoryMilestone(nominalSubtypeBrowserPromotionHistoryPath, inventoryPath), inventoryUpdate.currentSha256);
	assert.ok(pins > 0); assert.deepEqual(JSON.parse(checkpoint)
		, withHistoryMilestoneSourcePins(
			nominalSubtypeBrowserPromotionHistoryPath, expected
		)
	);
	assert.equal(expected.evidence.length, 516); assert.equal(expected.observations.length, 593);
	t.diagnostic(`${pins} current-source pins refreshed; exactly eighteen observed browser cells promoted or supplemented`);
});

test("nominal browser promotion writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-browser-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-browser-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
