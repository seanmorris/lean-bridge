/**
 * Verify the standalone nominal JVM promotion preserves all earlier source and support claims.
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
import { nominalSubtypeJvmReferences, promoteNominalSubtypeJvm } from "./nominal-subtype-jvm-promotion.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { beforeNominalSubtypePhpPromotionPins } from "./nominal-subtype-php-promotion-history.mjs";
import { beforeNominalSubtypeJvmPromotionSource, nominalSubtypeJvmPromotionChangedPaths, nominalSubtypeJvmPromotionHistoryPath, nominalSubtypeJvmPromotionPredecessor, reverseNominalSubtypeJvmPromotionUpdate } from "./nominal-subtype-jvm-promotion-history.mjs";

test("nominal JVM promotion history authenticates exact changes and the twelve observed JVM cells", async t => {
	const record = JSON.parse(await readFile(nominalSubtypeJvmPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-jvm-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypeJvmPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypeJvmPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypeJvmPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nominalSubtypeJvmPromotionHistoryPath, update.path
		);
		const previous = reverseNominalSubtypeJvmPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypeJvmPromotionSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypeJvmPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypeJvmPromotionSource(update.path, previous), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeNominalSubtypeJvmPromotionSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypeJvmPromotionUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = beforeNominalSubtypePhpPromotionPins(await promoteNominalSubtypeJvm(JSON.parse(original(inventoryPath)), await nominalSubtypeJvmReferences()));
	assert.equal(beforeNominalSubtypeJvmPromotionSource(inventoryPath, await sourceAtHistoryMilestone(nominalSubtypeJvmPromotionHistoryPath, inventoryPath)), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	const inventoryUpdate = record.updates.find(update => update.path === inventoryPath);
	const checkpoint = beforeNominalSubtypeJvmPromotionSource(inventoryPath, await sourceAtHistoryMilestone(nominalSubtypeJvmPromotionHistoryPath, inventoryPath), inventoryUpdate.currentSha256);
	assert.ok(pins > 0); assert.deepEqual(JSON.parse(checkpoint)
		, withHistoryMilestoneSourcePins(
			nominalSubtypeJvmPromotionHistoryPath, expected
		)
	);
	assert.equal(expected.evidence.length, 504); assert.equal(expected.observations.length, 587);
	t.diagnostic(`${pins} current-source pins refreshed; exactly twelve observed JVM cells promoted or supplemented`);
});

test("nominal JVM promotion writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-jvm-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-jvm-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
