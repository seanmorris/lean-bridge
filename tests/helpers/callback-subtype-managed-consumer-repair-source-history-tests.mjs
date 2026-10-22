/**
 * Authenticate managed callback Subtype consumer repair source history.
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
	beforeCallbackSubtypeManagedConsumerRepairSource
	, callbackSubtypeManagedConsumerRepairAddedPaths
	, callbackSubtypeManagedConsumerRepairChangedPaths
	, callbackSubtypeManagedConsumerRepairHistoryPath
	, callbackSubtypeManagedConsumerRepairImplementation
	, callbackSubtypeManagedConsumerRepairImplementationPaths
	, callbackSubtypeManagedConsumerRepairPredecessor
	, reverseCallbackSubtypeManagedConsumerRepairUpdate
} from "./callback-subtype-managed-consumer-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("managed callback Subtype consumer repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeManagedConsumerRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-subtype-managed-consumer-repair-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeManagedConsumerRepairPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeManagedConsumerRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeManagedConsumerRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackSubtypeManagedConsumerRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackSubtypeManagedConsumerRepairSource);
		const previous = git(["show"
			, `${callbackSubtypeManagedConsumerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeManagedConsumerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCallbackSubtypeManagedConsumerRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("managed callback Subtype consumer repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${callbackSubtypeManagedConsumerRepairImplementation}^`]).trim()
	, callbackSubtypeManagedConsumerRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackSubtypeManagedConsumerRepairPredecessor
		, callbackSubtypeManagedConsumerRepairImplementation]
	).trim().split("\n").sort()
	, [...callbackSubtypeManagedConsumerRepairImplementationPaths].sort());
});

test("managed callback Subtype consumer repair rejects altered transitions", async () => {
		const record = JSON.parse(await readFile(
			callbackSubtypeManagedConsumerRepairHistoryPath, "utf8"));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackSubtypeManagedConsumerRepairSource);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseCallbackSubtypeManagedConsumerRepairUpdate(
			current, update));
		const edited = structuredClone(record.updates[0]);
		edited.edits[0].current += "x";
		assert.throws(() => reverseCallbackSubtypeManagedConsumerRepairUpdate(
			current, edited));
		const unknown = structuredClone(record.updates[0]);
		unknown.path = "src/not-recorded.mjs";
		assert.throws(() => reverseCallbackSubtypeManagedConsumerRepairUpdate(
			current, unknown));
		assert.equal(beforeCallbackSubtypeManagedConsumerRepairSource(
			update.path, `${current}\n`), `${current}\n`);
});

test("managed callback Subtype repair writer refuses unrelated checkouts", async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-managed-subtype-repair-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const env = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const run = args => execFileSync("git", args
			, { cwd: root, env, stdio: "pipe" });
		run(["init", "--quiet"]);
		run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
			, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
			, "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-callback-subtype-managed-consumer-repair-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
});
