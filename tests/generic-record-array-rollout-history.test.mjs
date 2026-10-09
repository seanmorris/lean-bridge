/**
 * Preserve exact source predecessors and authenticated inventory changes for the native Array rollout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { readTypeSurface } from "../src/adoption/type-surface.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { supplementArrayRolloutInventory } from "./helpers/generic-record-array-rollout.mjs";
import { arrayRolloutChangedPaths, arrayRolloutHistoryPath, arrayRolloutPredecessor, beforeArrayRolloutSource, reverseArrayRolloutUpdate } from "./helpers/generic-record-array-rollout-source-history.mjs";

test("Array rollout history authenticates every exact predecessor and refuses unrecorded changes", async () => {
	const history = JSON.parse(await readFile(arrayRolloutHistoryPath));
	assert.equal(history.schemaVersion, 1); assert.equal(history.milestone, "generic-record-array-rollout-v1");
	assert.equal(history.predecessorCommit, arrayRolloutPredecessor);
	assert.deepEqual(history.updates.map(item => item.path), arrayRolloutChangedPaths);
	for(const update of history.updates)
	{
		const current = await readFile(update.path, "utf8"), previous = reverseArrayRolloutUpdate(current, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeArrayRolloutSource(update.path, current), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unknown edit\n";
		assert.equal(beforeArrayRolloutSource(update.path, changed), changed);
		assert.throws(() => reverseArrayRolloutUpdate(changed, update));
		assert.throws(() => reverseArrayRolloutUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseArrayRolloutUpdate(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseArrayRolloutUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Array rollout inventory changes match the supplement and every current source pin", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8"), current = JSON.parse(source);
	const previous = JSON.parse(beforeArrayRolloutSource(path, source));
	const history = JSON.parse(await readFile(arrayRolloutHistoryPath));
	const expected = await supplementArrayRolloutInventory(previous);
	let refreshed = 0;
	for(const entry of expected.evidence.slice(0, previous.evidence.length)) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
{ file.sha256 = update.currentSha256; refreshed++; }
	}
	assert.ok(refreshed > 0); assert.deepEqual(current, expected);
	assert.equal(previous.evidence.length, 310); assert.equal(current.evidence.length, 323);
	assert.equal(current.observations.length, 499); assert.equal(previous.observations.length, 499);
	assert.deepEqual((await readTypeSurface()).document, current);
	const files = new Map();
	for(const entry of current.evidence) for(const file of entry.files)
	{
		if(!files.has(file.path)) files.set(file.path, sha256(await readFile(file.path)));
		assert.equal(files.get(file.path), file.sha256, file.path);
	}
});

test("Array rollout archive, CI, inventory and history tests are registered", () => {
	for(const name of ["generic-record-array-evidence", "generic-record-array-host-evidence", "generic-record-array-ci", "generic-record-array-rollout", "generic-record-array-rollout-history"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("Array rollout writer refuses an unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-array-rollout-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-generic-record-array-rollout-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Native Array rollout history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
