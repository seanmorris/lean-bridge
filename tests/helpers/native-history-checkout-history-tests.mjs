/**
 * Preserve earlier evidence while requiring native and managed CI source history.
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
import { beforeNativeHistoryCheckoutSource, nativeHistoryCheckoutChangedPaths, nativeHistoryCheckoutHistoryPath, nativeHistoryCheckoutPredecessor, reverseNativeHistoryCheckoutUpdate } from "./native-history-checkout-history.mjs";

test("Native history checkout authenticates exact changes and restores the original support inventory", async () => {
	const record = JSON.parse(await readFile(nativeHistoryCheckoutHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "native-history-checkout-source-v1");
	assert.equal(record.predecessorCommit, nativeHistoryCheckoutPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nativeHistoryCheckoutChangedPaths);
	const original = path => execFileSync("git", ["show", `${nativeHistoryCheckoutPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const previous = reverseNativeHistoryCheckoutUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNativeHistoryCheckoutSource(update.path, current), previous);
		assert.equal(beforeNativeHistoryCheckoutSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNativeHistoryCheckoutSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNativeHistoryCheckoutSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNativeHistoryCheckoutUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	assert.equal(beforeNativeHistoryCheckoutSource(inventoryPath, await sourceAtHistoryMilestone(nativeHistoryCheckoutHistoryPath, inventoryPath)), original(inventoryPath));
	const expected = JSON.parse(original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 110);
	const currentInventory = beforeNativeHistoryCheckoutSource(inventoryPath, await sourceAtHistoryMilestone(nativeHistoryCheckoutHistoryPath, inventoryPath), record.updates.find(item => item.path === inventoryPath).currentSha256);
	assert.deepEqual(JSON.parse(currentInventory), expected);
	assert.equal(expected.evidence.length, 472); assert.equal(expected.observations.length, 571);
	const boundaryPath = "nix/perl-engine-source-boundary.json";
	const previousBoundary = JSON.parse(original(boundaryPath)), boundary = JSON.parse(await readFile(boundaryPath, "utf8"));
	assert.deepEqual({ ...boundary, includedFiles: previousBoundary.includedFiles }, previousBoundary);
	const added = ["src/build/component-fin-guards.mjs", "src/build/component-refinement-mirrors.mjs", "src/build/refinement-mirrors.mjs"];
	assert.deepEqual(boundary.includedFiles.filter(path => !previousBoundary.includedFiles.includes(path)), added);
	assert.deepEqual(boundary.includedFiles.filter(path => !added.includes(path)), previousBoundary.includedFiles);
});

test("Native history checkout history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-history-checkout-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-native-history-checkout-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
