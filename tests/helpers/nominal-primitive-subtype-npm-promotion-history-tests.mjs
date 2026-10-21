/**
 * Preserve prior proofs and support records through the exact nineteen-base npm update.
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
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { beforeNominalPrimitiveSubtypePythonPromotionPins } from "./nominal-primitive-subtype-python-promotion-history.mjs";
import { nominalPrimitiveSubtypeNpmReferences, promoteNominalPrimitiveSubtypeNpm } from "./nominal-primitive-subtype-npm-promotion.mjs";
import { beforeNominalPrimitiveSubtypeNpmPromotionSource, nominalPrimitiveSubtypeNpmPromotionChangedPaths, nominalPrimitiveSubtypeNpmPromotionHistoryPath, nominalPrimitiveSubtypeNpmPromotionPredecessor, reverseNominalPrimitiveSubtypeNpmPromotionUpdate } from "./nominal-primitive-subtype-npm-promotion-history.mjs";

test("primitive-base npm promotion history authenticates the exact Node-only support and docs transition", async t => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeNpmPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-primitive-subtype-npm-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypeNpmPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalPrimitiveSubtypeNpmPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalPrimitiveSubtypeNpmPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nominalPrimitiveSubtypeNpmPromotionHistoryPath, update.path
		);
		const previous = reverseNominalPrimitiveSubtypeNpmPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeNpmPromotionSource(update.path, current), previous);
		assert.equal(beforeNominalPrimitiveSubtypeNpmPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalPrimitiveSubtypeNpmPromotionSource(update.path, previous), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeNpmPromotionSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalPrimitiveSubtypeNpmPromotionUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = beforeNominalPrimitiveSubtypePythonPromotionPins(await promoteNominalPrimitiveSubtypeNpm(JSON.parse(original(inventoryPath)), await nominalPrimitiveSubtypeNpmReferences()));
	assert.equal(beforeNominalPrimitiveSubtypeNpmPromotionSource(inventoryPath, await sourceAtHistoryMilestone(nominalPrimitiveSubtypeNpmPromotionHistoryPath, inventoryPath)), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	const update = record.updates.find(item => item.path === inventoryPath);
	const checkpoint = beforeNominalPrimitiveSubtypeNpmPromotionSource(inventoryPath, await sourceAtHistoryMilestone(nominalPrimitiveSubtypeNpmPromotionHistoryPath, inventoryPath), update.currentSha256);
	assert.deepEqual(JSON.parse(checkpoint), withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypeNpmPromotionHistoryPath, expected
	));
	assert.equal(expected.evidence.length, 524); assert.equal(expected.observations.length, 595);
	t.diagnostic(`${pins} current-source pins refreshed; exactly twelve existing Node cells supplemented`);
});

test("primitive-base npm promotion writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-npm-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-primitive-subtype-npm-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
