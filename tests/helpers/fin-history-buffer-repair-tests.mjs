/**
 * Refuse unknown history edits and retain exact epochs when reading file Buffers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedSubtypeNativePromotionSource } from "./reviewed-subtype-native-promotion-history.mjs";
import { beforeFinHistoryBufferRepairSource, finHistoryBufferRepairChangedPaths, finHistoryBufferRepairHistoryPath, finHistoryBufferRepairPredecessor, reverseFinHistoryBufferRepairUpdate } from "./fin-history-buffer-repair.mjs";

test("Buffer repair authenticates all source transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(finHistoryBufferRepairHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "fin-history-buffer-repair-v1");
	assert.equal(history.predecessorCommit, finHistoryBufferRepairPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), finHistoryBufferRepairChangedPaths);
	for(const update of history.updates)
	{
		const bytes = Buffer.from(beforeReviewedSubtypeNativePromotionSource(update.path, await readFile(update.path, "utf8"))), source = bytes.toString();
		const previous = reverseFinHistoryBufferRepairUpdate(source, update);
		assert.equal(beforeFinHistoryBufferRepairSource(update.path, source), previous);
		assert.equal(beforeFinHistoryBufferRepairSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.previousSha256), previous);
		assert.equal(beforeFinHistoryBufferRepairSource(update.path, previous), previous);
		const changed = source + "\n// unknown edit\n";
		assert.equal(beforeFinHistoryBufferRepairSource(update.path, changed), changed);
		assert.throws(() => reverseFinHistoryBufferRepairUpdate(changed, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits.push(item.edits[0]); }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]){
			const corrupt = structuredClone(update); mutate(corrupt);
			assert.throws(() => reverseFinHistoryBufferRepairUpdate(source, corrupt));
			}
	}
});

test("native-model Buffer reads select both recorded epochs without accepting changed bytes", async () => {
	const path = "src/build/native-model.mjs", bytes = await readFile(path);
	for(const expected of [
		"aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
		, "dd29801162eeaa06fe0c96b8d71c6b1994033ab52440ec39ecf62e5d832dd6ae"
	]){
		const restored = beforeFinRefinementSource(path, bytes, expected);
		assert.equal(sha256(restored), expected);
		assert.equal(beforeFinRefinementSource(path, restored, expected), restored);
		for(const changed of [Buffer.concat([bytes, Buffer.from("\n")]), Buffer.from(bytes.subarray(1)), Buffer.from([0, 255, 254, 128])])
		{
			assert.equal(beforeFinRefinementSource(path, changed, expected), changed);
			assert.notEqual(sha256(changed), expected);
		}
	}
	assert.equal(beforeFinRefinementSource(path, bytes, sha256(bytes)), bytes);
	assert.equal(beforeFinRefinementSource("unknown.bin", bytes), bytes);
	const invalid = "0".repeat(64);
	assert.notEqual(sha256(beforeFinRefinementSource(path, bytes, invalid)), invalid);
});

test("Buffer repair preserves the inventory, previous ledger and original three-failure reproduction", async () => {
	const history = JSON.parse(await readFile(finHistoryBufferRepairHistoryPath));
	assert.equal(history.inventorySha256, "6a608542a14568c731ca961707e26d68975fb3d58d56443d45606c5b6f804c02");
	assert.equal(sha256(beforeReviewedSubtypeNativePromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"))), history.inventorySha256);
	assert.equal(sha256(await readFile("docs/evidence/refinement-followup-source-history-20261010.json")), "a7fdc0c266afd2b3ea4ce29fc5e99dbb554df277a06dc7af252614bca7aeafc1");
	const original = await readFile(history.reproduction.path);
	assert.equal(original.length, history.reproduction.bytes);
	assert.equal(sha256(original), history.reproduction.sha256);
	assert.equal(history.reproduction.sha256, "abb42414c2e4e4b9fa5105fcba9b564c2d629dcb14e558250c70ceb98d651f1c");
	assert.match(original.toString(), /^# tests 10$/mu);
	assert.match(original.toString(), /^# fail 3$/mu);
	assert.match(original.toString(), /^# skipped 0$/mu);
	assert.equal([...original.toString().matchAll(/^not ok /gmu)].length, 3);
});

test("Buffer repair writer refuses unrelated HEAD before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-buffer-repair-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-fin-history-buffer-repair.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
