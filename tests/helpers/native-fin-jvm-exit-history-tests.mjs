/**
 * Verify scalar JVM exit source transitions without rewriting earlier observations.
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
import { beforeNativeFinJvmExitSource, nativeFinJvmExitChangedPaths, nativeFinJvmExitHistoryPath, nativeFinJvmExitPredecessor, reverseNativeFinJvmExitUpdate } from "./native-fin-jvm-exit-history.mjs";

test("scalar JVM exit repair preserves exact historical producers and support claims", async () => {
	const record = JSON.parse(await readFile(nativeFinJvmExitHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "native-fin-jvm-exit-source-v1");
	assert.equal(record.predecessorCommit, nativeFinJvmExitPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nativeFinJvmExitChangedPaths);
	const original = path => execFileSync("git", ["show", `${nativeFinJvmExitPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeNativeFinJvmExitSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseNativeFinJvmExitUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNativeFinJvmExitSource(update.path, current), previous);
		assert.equal(beforeNativeFinJvmExitSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNativeFinJvmExitSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNativeFinJvmExitSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNativeFinJvmExitUpdate(current, changed));
		}
	}
	const path = "docs/type-surface.v1.json", inventory = JSON.parse(original(path));
	assert.equal(beforeFinRefinementSource(path, await readFile(path, "utf8"), sha256(original(path))), original(path));
	assert.equal(inventory.evidence.length, 500); assert.equal(inventory.observations.length, 585);
	const currentInventory = JSON.parse(await readFile(path));
	const pin = currentInventory.evidence.find(entry => entry.id === "jvm-fin-installed").files
		.find(file => file.path === "tests/jvm-fin.test.mjs");
	assert.equal(pin.sha256, sha256(await readFile(pin.path)));
	pin.sha256 = sha256(original(pin.path));
	assert.deepEqual(currentInventory, inventory, "only the exact producer source pin changes");
});

test("scalar JVM exit history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-scalar-jvm-exit-history-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-native-fin-jvm-exit-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
