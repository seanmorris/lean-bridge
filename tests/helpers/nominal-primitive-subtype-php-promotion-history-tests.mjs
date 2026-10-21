/**
 * Preserve prior proofs through the exact nineteen-base native PHP promotion.
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
import {
	nominalPrimitiveSubtypePhpReferences
	, promoteNominalPrimitiveSubtypePhp
} from "./nominal-primitive-subtype-php-promotion.mjs";
import {
	beforeNominalPrimitiveSubtypePhpPromotionSource
	, nominalPrimitiveSubtypePhpPromotionChangedPaths
	, nominalPrimitiveSubtypePhpPromotionHistoryPath
	, nominalPrimitiveSubtypePhpPromotionPredecessor
	, reverseNominalPrimitiveSubtypePhpPromotionUpdate
} from "./nominal-primitive-subtype-php-promotion-history.mjs";

test("primitive-base native PHP history authenticates the support transition", async t => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypePhpPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "nominal-primitive-subtype-php-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypePhpPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path),
		nominalPrimitiveSubtypePhpPromotionChangedPaths);
	const original = path => execFileSync("git", [
		"show", `${nominalPrimitiveSubtypePhpPromotionPredecessor}:${path}`
	], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nominalPrimitiveSubtypePhpPromotionHistoryPath, update.path
		);
		const previous = reverseNominalPrimitiveSubtypePhpPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalPrimitiveSubtypePhpPromotionSource(update.path, current),
			previous);
		assert.equal(beforeNominalPrimitiveSubtypePhpPromotionSource(
			update.path, current, update.currentSha256
		), current);
		assert.equal(beforeNominalPrimitiveSubtypePhpPromotionSource(
			update.path, previous, update.previousSha256
		), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeNominalPrimitiveSubtypePhpPromotionSource(
			update.path, current + "unknown"
		), current + "unknown");
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() =>
				reverseNominalPrimitiveSubtypePhpPromotionUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = await promoteNominalPrimitiveSubtypePhp(
		JSON.parse(original(inventoryPath)), await nominalPrimitiveSubtypePhpReferences()
	);
	const checkpoint = await sourceAtHistoryMilestone(
		nominalPrimitiveSubtypePhpPromotionHistoryPath, inventoryPath
	);
	assert.equal(beforeNominalPrimitiveSubtypePhpPromotionSource(
		inventoryPath, checkpoint
	), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.deepEqual(JSON.parse(checkpoint), withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypePhpPromotionHistoryPath, expected
	));
	assert.equal(expected.evidence.length, 556); assert.equal(expected.observations.length, 595);
	t.diagnostic(`${pins} current-source pins refreshed; exactly six native PHP cells supplemented`);
});

test("primitive-base native PHP history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-primitive-php-promotion-history-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m"
		, "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-nominal-primitive-subtype-php-promotion-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
