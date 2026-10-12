/**
 * Preserve the original WIT checkout evidence while fixing its workflow epoch.
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
import { beforeWitHistoryCheckoutRepairSource, witHistoryCheckoutRepairChangedPaths, witHistoryCheckoutRepairHistoryPath, witHistoryCheckoutRepairPredecessor, reverseWitHistoryCheckoutRepairUpdate } from "./wit-history-checkout-repair-history.mjs";

test("WIT workflow comparison repair preserves exact original sources and support claims", async () => {
	const record = JSON.parse(await readFile(witHistoryCheckoutRepairHistoryPath));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "wit-history-checkout-repair-source-v1");
	assert.equal(record.predecessorCommit, witHistoryCheckoutRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), witHistoryCheckoutRepairChangedPaths);
	const original = path => execFileSync("git", [
		"show", `${witHistoryCheckoutRepairPredecessor}:${path}`
	], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeWitHistoryCheckoutRepairSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const previous = reverseWitHistoryCheckoutRepairUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeWitHistoryCheckoutRepairSource(update.path, current), previous);
		assert.equal(beforeWitHistoryCheckoutRepairSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeWitHistoryCheckoutRepairSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeWitHistoryCheckoutRepairSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => reverseWitHistoryCheckoutRepairUpdate(current, changed));
		}
	}
	const path = "docs/type-surface.v1.json";
	const inventory = JSON.parse(original(path));
	assert.equal(await readFile(path, "utf8"), original(path));
	assert.equal(inventory.evidence.length, 496);
	assert.equal(inventory.observations.length, 583);
	for(const entry of inventory.evidence) for(const file of entry.files)
		assert.ok(!witHistoryCheckoutRepairChangedPaths.includes(file.path));
	const workflow = ".github/workflows/consumer-matrix.yml";
	assert.equal(await readFile(workflow, "utf8"), original(workflow));
});

test("WIT workflow repair writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-history-repair-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [
		resolve("scripts/update-wit-history-checkout-repair-history.mjs")
	], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
