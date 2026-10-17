/**
 * Preserve earlier evidence while promoting the installed PHP-Wasm scope.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { beforeCheckedRecordPhpWasmPromotionSource, checkedRecordPhpWasmPromotionChangedPaths, checkedRecordPhpWasmPromotionHistoryPath, checkedRecordPhpWasmPromotionPredecessor, reverseCheckedRecordPhpWasmPromotionUpdate } from "./checked-record-php-wasm-promotion-history.mjs";

test("Checked-record PHP-Wasm promotion authenticates exact changes and restores the original support inventory", async () => {
	const record = JSON.parse(await readFile(checkedRecordPhpWasmPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "checked-record-php-wasm-promotion-v1");
	assert.equal(record.predecessorCommit, checkedRecordPhpWasmPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), checkedRecordPhpWasmPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${checkedRecordPhpWasmPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			checkedRecordPhpWasmPromotionHistoryPath, update.path
		);
		const previous = reverseCheckedRecordPhpWasmPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeCheckedRecordPhpWasmPromotionSource(update.path, current), previous);
		assert.equal(beforeCheckedRecordPhpWasmPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeCheckedRecordPhpWasmPromotionSource(update.path, previous), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeCheckedRecordPhpWasmPromotionSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedRecordPhpWasmPromotionUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	assert.equal(beforeCheckedRecordPhpWasmPromotionSource(inventoryPath, await sourceAtHistoryMilestone(checkedRecordPhpWasmPromotionHistoryPath, inventoryPath)), original(inventoryPath));
});

test("Checked-record PHP-Wasm promotion history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-php-wasm-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-checked-record-php-wasm-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
