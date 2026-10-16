/**
 * Preserve prior proofs through the exact nineteen-base JVM promotion.
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
import { nominalPrimitiveSubtypeJvmReferences, promoteNominalPrimitiveSubtypeJvm } from "./nominal-primitive-subtype-jvm-promotion.mjs";
import {
	beforeNominalPrimitiveSubtypeJvmPromotionSource
	, nominalPrimitiveSubtypeJvmPromotionChangedPaths
	, nominalPrimitiveSubtypeJvmPromotionDraftParent
	, nominalPrimitiveSubtypeJvmPromotionHistoryPath
	, nominalPrimitiveSubtypeJvmPromotionPredecessor
	, reverseNominalPrimitiveSubtypeJvmPromotionUpdate
} from "./nominal-primitive-subtype-jvm-promotion-history.mjs";

test("primitive-base JVM history authenticates the support transition", async t => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeJvmPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "nominal-primitive-subtype-jvm-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypeJvmPromotionPredecessor);
	assert.equal(record.draftParentCommit, nominalPrimitiveSubtypeJvmPromotionDraftParent);
	assert.deepEqual(record.updates.map(update => update.path), nominalPrimitiveSubtypeJvmPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalPrimitiveSubtypeJvmPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeNominalPrimitiveSubtypeJvmPromotionSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseNominalPrimitiveSubtypeJvmPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeJvmPromotionSource(update.path, current), previous);
		assert.equal(beforeNominalPrimitiveSubtypeJvmPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalPrimitiveSubtypeJvmPromotionSource(update.path, previous, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalPrimitiveSubtypeJvmPromotionSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalPrimitiveSubtypeJvmPromotionUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = await promoteNominalPrimitiveSubtypeJvm(JSON.parse(original(inventoryPath)), await nominalPrimitiveSubtypeJvmReferences());
	assert.equal(beforeNominalPrimitiveSubtypeJvmPromotionSource(inventoryPath, await readFile(inventoryPath, "utf8")), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	const update = record.updates.find(item => item.path === inventoryPath);
	const checkpoint = beforeNominalPrimitiveSubtypeJvmPromotionSource(inventoryPath, await readFile(inventoryPath, "utf8"), update.currentSha256);
	assert.equal(JSON.stringify(JSON.parse(checkpoint)), JSON.stringify(expected));
	assert.equal(expected.evidence.length, 574); assert.equal(expected.observations.length, 605);
	t.diagnostic(`${pins} current-source pins refreshed; exactly twelve Java and Kotlin cells supplemented`);
});

test("primitive-base JVM history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-jvm-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-primitive-subtype-jvm-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
