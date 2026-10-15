/**
 * Preserve every earlier source receipt through the Core quality budget correction.
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
import { beforeNominalPrimitiveSubtypeRubyPromotionSource } from "./nominal-primitive-subtype-ruby-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeRustPromotionSource } from "./nominal-primitive-subtype-rust-promotion-history.mjs";
import { beforeCoreQualityBudgetSource, coreQualityBudgetChangedPaths, coreQualityBudgetHistoryPath, coreQualityBudgetPredecessor, reverseCoreQualityBudgetUpdate } from "./core-quality-budget-history.mjs";

test("Core quality budget history authenticates the exact bounded workflow transition", async () => {
	const record = JSON.parse(await readFile(coreQualityBudgetHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "core-quality-budget-source-v1");
	assert.equal(record.predecessorCommit, coreQualityBudgetPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), coreQualityBudgetChangedPaths);
	const original = path => execFileSync("git", ["show", `${coreQualityBudgetPredecessor}:${path}`]
		, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeCoreQualityBudgetSource(update.path, beforeNominalPrimitiveSubtypeRubyPromotionSource(update.path, beforeNominalPrimitiveSubtypeRustPromotionSource(update.path, await readFile(update.path, "utf8"))), update.currentSha256);
		const previous = reverseCoreQualityBudgetUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeCoreQualityBudgetSource(update.path, current), previous);
		assert.equal(beforeCoreQualityBudgetSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeCoreQualityBudgetSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeCoreQualityBudgetSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCoreQualityBudgetUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = JSON.parse(original(inventoryPath));
	let pins = 0;
	for(const collection of [expected.evidence, expected.observations]) for(const entry of collection) for(const file of entry.files ?? [])
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 4);
	const inventoryUpdate = record.updates.find(update => update.path === inventoryPath);
	const checkpoint = beforeCoreQualityBudgetSource(inventoryPath, beforeNominalPrimitiveSubtypeRubyPromotionSource(inventoryPath, beforeNominalPrimitiveSubtypeRustPromotionSource(inventoryPath, await readFile(inventoryPath, "utf8"))), inventoryUpdate.currentSha256);
	assert.deepEqual(JSON.parse(checkpoint), expected);
	assert.equal(beforeFinRefinementSource(inventoryPath, await readFile(inventoryPath, "utf8"), inventoryUpdate.previousSha256), original(inventoryPath));
});

test("Core quality budget history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-core-quality-budget-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-core-quality-budget-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
