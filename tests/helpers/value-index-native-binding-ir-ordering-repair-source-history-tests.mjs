/**
 * Test the reversible current-source ordering repair for native value-index
 * history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeValueIndexNativeBindingIrOrderingRepairSource
	, reverseValueIndexNativeBindingIrOrderingRepairUpdate
	, valueIndexNativeBindingIrOrderingRepairAddedPaths
	, valueIndexNativeBindingIrOrderingRepairChangedPaths
	, valueIndexNativeBindingIrOrderingRepairHistoryPath
	, valueIndexNativeBindingIrOrderingRepairPredecessor
} from "./value-index-native-binding-ir-ordering-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("native Binding-IR ordering repair is exact and reversible", async () => {
	const record = JSON.parse(await readFile(
		valueIndexNativeBindingIrOrderingRepairHistoryPath, "utf8"
	));
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "milestone", "pathsSha256", "predecessorCommit", "schemaVersion"
		, "updates"
	]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "value-index-native-binding-ir-ordering-repair-v1");
	assert.equal(record.predecessorCommit
		, valueIndexNativeBindingIrOrderingRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, valueIndexNativeBindingIrOrderingRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, valueIndexNativeBindingIrOrderingRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		valueIndexNativeBindingIrOrderingRepairChangedPaths
	)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeValueIndexNativeBindingIrOrderingRepairSource
		);
		const previous = git(["show"
			, `${valueIndexNativeBindingIrOrderingRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseValueIndexNativeBindingIrOrderingRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeValueIndexNativeBindingIrOrderingRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeValueIndexNativeBindingIrOrderingRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeValueIndexNativeBindingIrOrderingRepairSource(
			update.path, current + "unknown"), current + "unknown", update.path);
	}
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path)), addition.currentSha256);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${valueIndexNativeBindingIrOrderingRepairPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("native Binding-IR ordering repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-binding-ir-ordering-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c"
		, "commit.gpgsign=false"
		, "commit"
		, "--allow-empty"
		, "--quiet"
		, "-m"
		, "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-value-index-native-binding-ir-ordering-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
