/**
 * Require exact ownership CI source transitions without changing prior claims.
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
import { sha256 } from "./source-history-digest.mjs";
import { beforeNativeOwnedGateSource, nativeOwnedGateChangedPaths, nativeOwnedGateHistoryPath, nativeOwnedGatePredecessor, reverseNativeOwnedGateUpdate } from "./native-owned-gate-history.mjs";

test("native owned CI repair preserves exact historical probes and the support inventory", async () => {
	const record = JSON.parse(await readFile(nativeOwnedGateHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "native-owned-gate-source-v1");
	assert.equal(record.predecessorCommit, nativeOwnedGatePredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nativeOwnedGateChangedPaths);
	const original = path => execFileSync("git", ["show", `${nativeOwnedGatePredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const previous = reverseNativeOwnedGateUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNativeOwnedGateSource(update.path, current), previous);
		assert.equal(beforeNativeOwnedGateSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNativeOwnedGateSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNativeOwnedGateSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNativeOwnedGateUpdate(current, changed));
		}
	}
	const path = "docs/type-surface.v1.json", inventory = JSON.parse(original(path));
	assert.equal(beforeFinRefinementSource(path, await readFile(path, "utf8"), sha256(original(path))), original(path));
	assert.equal(inventory.evidence.length, 500); assert.equal(inventory.observations.length, 585);
	for(const entry of inventory.evidence) for(const file of entry.files)
		assert.ok(!nativeOwnedGateChangedPaths.includes(file.path));
});

test("native owned CI history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-owned-gate-history-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-native-owned-gate-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
