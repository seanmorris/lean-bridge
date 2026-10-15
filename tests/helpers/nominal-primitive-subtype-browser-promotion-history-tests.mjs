/**
 * Preserve prior proofs and support records through the exact nineteen-base browser update.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNominalPrimitiveSubtypeNativePromotionPins } from "./nominal-primitive-subtype-native-promotion-history.mjs";
import { nominalPrimitiveSubtypeBrowserReferences, promoteNominalPrimitiveSubtypeBrowser } from "./nominal-primitive-subtype-browser-promotion.mjs";
import { beforeNominalPrimitiveSubtypeBrowserPromotionSource, nominalPrimitiveSubtypeBrowserPromotionChangedPaths, nominalPrimitiveSubtypeBrowserPromotionHistoryPath, nominalPrimitiveSubtypeBrowserPromotionPredecessor, reverseNominalPrimitiveSubtypeBrowserPromotionUpdate } from "./nominal-primitive-subtype-browser-promotion-history.mjs";

test("primitive-base browser promotion history authenticates the exact browser-only support and docs transition", async t => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeBrowserPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-primitive-subtype-browser-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypeBrowserPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalPrimitiveSubtypeBrowserPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalPrimitiveSubtypeBrowserPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeNominalPrimitiveSubtypeBrowserPromotionSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseNominalPrimitiveSubtypeBrowserPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeBrowserPromotionSource(update.path, current), previous);
		assert.equal(beforeNominalPrimitiveSubtypeBrowserPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalPrimitiveSubtypeBrowserPromotionSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalPrimitiveSubtypeBrowserPromotionSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalPrimitiveSubtypeBrowserPromotionUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = beforeNominalPrimitiveSubtypeNativePromotionPins(await promoteNominalPrimitiveSubtypeBrowser(JSON.parse(original(inventoryPath)), await nominalPrimitiveSubtypeBrowserReferences()));
	assert.equal(beforeNominalPrimitiveSubtypeBrowserPromotionSource(inventoryPath, await readFile(inventoryPath, "utf8")), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	const update = record.updates.find(item => item.path === inventoryPath);
	const checkpoint = beforeNominalPrimitiveSubtypeBrowserPromotionSource(inventoryPath, await readFile(inventoryPath, "utf8"), update.currentSha256);
	assert.deepEqual(JSON.parse(checkpoint), expected);
	assert.equal(expected.evidence.length, 532); assert.equal(expected.observations.length, 595);
	t.diagnostic(`${pins} current-source pins refreshed; exactly eighteen existing browser cells supplemented`);
});

test("primitive-base browser promotion writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-browser-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-primitive-subtype-browser-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
