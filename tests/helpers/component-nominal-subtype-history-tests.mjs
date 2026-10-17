/**
 * Preserve earlier evidence while admitting public nominal Subtype adapters.
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
import { beforeComponentNominalSubtypeSource, componentNominalSubtypeChangedPaths, componentNominalSubtypeHistoryPath, componentNominalSubtypePredecessor, reverseComponentNominalSubtypeUpdate } from "./component-nominal-subtype-history.mjs";

test("Component nominal Subtype authenticates exact changes and restores the original support inventory", async () => {
	const record = JSON.parse(await readFile(componentNominalSubtypeHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "component-nominal-subtype-source-v1");
	assert.equal(record.predecessorCommit, componentNominalSubtypePredecessor);
	assert.deepEqual(record.updates.map(update => update.path), componentNominalSubtypeChangedPaths);
	const original = path => execFileSync("git", ["show", `${componentNominalSubtypePredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const previous = reverseComponentNominalSubtypeUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeComponentNominalSubtypeSource(update.path, current), previous);
		assert.equal(beforeComponentNominalSubtypeSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeComponentNominalSubtypeSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeComponentNominalSubtypeSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseComponentNominalSubtypeUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	assert.equal(beforeComponentNominalSubtypeSource(inventoryPath, await sourceAtHistoryMilestone(componentNominalSubtypeHistoryPath, inventoryPath)), original(inventoryPath));
	const expected = JSON.parse(original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 315);
	const currentInventory = beforeComponentNominalSubtypeSource(inventoryPath, await sourceAtHistoryMilestone(componentNominalSubtypeHistoryPath, inventoryPath), record.updates.find(item => item.path === inventoryPath).currentSha256);
	assert.deepEqual(JSON.parse(currentInventory), expected);
	assert.equal(expected.evidence.length, 472); assert.equal(expected.observations.length, 571);
});

test("Component nominal Subtype history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-component-nominal-subtype-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-component-nominal-subtype-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
