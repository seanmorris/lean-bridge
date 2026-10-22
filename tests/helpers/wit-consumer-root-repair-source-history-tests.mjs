/**
 * Authenticate the WIT dependent checked-record consumer-root repair history.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeWitConsumerRootRepairSource
	, witConsumerRootRepairAddedPaths
	, witConsumerRootRepairChangedPaths
	, witConsumerRootRepairHistoryPath
	, witConsumerRootRepairImplementation
	, witConsumerRootRepairImplementationPaths
	, witConsumerRootRepairPredecessor
	, reverseWitConsumerRootRepairUpdate
} from "./wit-consumer-root-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("WIT consumer-root repair history restores every source", async () => {
	const record = JSON.parse(await readFile(witConsumerRootRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "wit-consumer-root-repair-v1");
	assert.equal(record.predecessorCommit, witConsumerRootRepairPredecessor);
	assert.equal(record.implementationCommit, witConsumerRootRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path), witConsumerRootRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path), witConsumerRootRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeWitConsumerRootRepairSource);
		const previous = git(["show", `${witConsumerRootRepairPredecessor}:${update.path}`]);
		assert.equal(reverseWitConsumerRootRepairUpdate(current, update), previous, update.path);
		assert.equal(beforeWitConsumerRootRepairSource(update.path, current), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("nominal entry repair implementation range is exact", () => {
	assert.equal(git(["rev-parse", `${witConsumerRootRepairImplementation}^`]).trim()
		, witConsumerRootRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, witConsumerRootRepairPredecessor, witConsumerRootRepairImplementation])
		.trim().split("\n").sort(), [...witConsumerRootRepairImplementationPaths].sort());
});

test("WIT consumer-root repair history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(witConsumerRootRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeWitConsumerRootRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseWitConsumerRootRepairUpdate(current, update));
	const edited = structuredClone(record.updates[0]);
	edited.edits[0].current += "x";
	assert.throws(() => reverseWitConsumerRootRepairUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]);
	unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reverseWitConsumerRootRepairUpdate(current, unknown));
	// An unrecorded source is left untouched rather than guessed at.
	assert.equal(beforeWitConsumerRootRepairSource(update.path, `${current}\n`), `${current}\n`);
});

test("WIT consumer-root repair history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-wit-consumer-root-repair-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-wit-consumer-root-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
