/**
 * Preserve earlier evidence while adding per-use constructor-free native result metadata.
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
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeSubtypeResultSource, subtypeResultChangedPaths, subtypeResultHistoryPath, subtypeResultPredecessor, reverseSubtypeResultUpdate } from "./subtype-result-history.mjs";

test("Native Subtype result projection authenticates exact changes and restores the original support inventory", async () => {
	const record = JSON.parse(await readFile(subtypeResultHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "subtype-result-source-v1");
	assert.equal(record.predecessorCommit, subtypeResultPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), subtypeResultChangedPaths);
	const original = path => execFileSync("git", ["show", `${subtypeResultPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const previous = reverseSubtypeResultUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeSubtypeResultSource(update.path, current), previous);
		assert.equal(beforeSubtypeResultSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeSubtypeResultSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeSubtypeResultSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseSubtypeResultUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	assert.equal(beforeSubtypeResultSource(inventoryPath, await sourceAtHistoryMilestone(subtypeResultHistoryPath, inventoryPath)), original(inventoryPath));
});

test("Native Subtype result projection history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-subtype-result-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-subtype-result-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
