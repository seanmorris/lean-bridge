/**
 * Preserve prior proofs through the exact nineteen-base WIT promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
} from "./source-history-test-source.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { beforeNominalPrimitiveSubtypeJvmPromotionPins } from "./nominal-primitive-subtype-jvm-promotion-history.mjs";
import { nominalPrimitiveSubtypeWitReferences, promoteNominalPrimitiveSubtypeWit } from "./nominal-primitive-subtype-wit-promotion.mjs";
import {
	beforeNominalPrimitiveSubtypeWitPromotionSource
	, nominalPrimitiveSubtypeWitPromotionChangedPaths
	, nominalPrimitiveSubtypeWitPromotionDraftParent
	, nominalPrimitiveSubtypeWitPromotionHistoryPath
	, nominalPrimitiveSubtypeWitPromotionPredecessor
	, reverseNominalPrimitiveSubtypeWitPromotionUpdate
} from "./nominal-primitive-subtype-wit-promotion-history.mjs";

test("primitive-base WIT history authenticates the support transition", async t => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeWitPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "nominal-primitive-subtype-wit-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypeWitPromotionPredecessor);
	assert.equal(record.draftParentCommit, nominalPrimitiveSubtypeWitPromotionDraftParent);
	assert.deepEqual(record.updates.map(update => update.path), nominalPrimitiveSubtypeWitPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalPrimitiveSubtypeWitPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nominalPrimitiveSubtypeWitPromotionHistoryPath, update.path
		);
		const previous = reverseNominalPrimitiveSubtypeWitPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeWitPromotionSource(update.path, current), previous);
		assert.equal(beforeNominalPrimitiveSubtypeWitPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalPrimitiveSubtypeWitPromotionSource(update.path, previous, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeWitPromotionSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalPrimitiveSubtypeWitPromotionUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = beforeNominalPrimitiveSubtypeJvmPromotionPins(await promoteNominalPrimitiveSubtypeWit(JSON.parse(original(inventoryPath)), await nominalPrimitiveSubtypeWitReferences()));
	const checkpoint = await sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeWitPromotionHistoryPath, inventoryPath
	);
	assert.equal(beforeNominalPrimitiveSubtypeWitPromotionSource(inventoryPath, checkpoint), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.deepEqual(JSON.parse(checkpoint), withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypeWitPromotionHistoryPath, expected
	));
	assert.equal(expected.evidence.length, 570); assert.equal(expected.observations.length, 605);
	t.diagnostic(`${pins} current-source pins refreshed; exactly six WIT cells supplemented`);
});

test("primitive-base WIT history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-wit-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-primitive-subtype-wit-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
