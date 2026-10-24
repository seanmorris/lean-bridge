/**
 * Authenticate the owned transfer-copy evidence replay repair.
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
	beforeOwnedTransferCopyReplayRepairSource
	, ownedReplayHistoricalGapGroups
	, ownedReplayHistoricalGapPaths
	, ownedTransferCopyHistoricalCommit
	, ownedTransferCopyHistoricalPaths
	, ownedTransferCopyHistoricalPredecessor
	, ownedTransferCopyNativeFollowupCommit
	, ownedTransferCopyNativeFollowupPaths
	, ownedTransferCopyReplayRepairAddedPaths
	, ownedTransferCopyReplayRepairHistoryPath
	, ownedTransferCopyReplayRepairImplementation
	, ownedTransferCopyReplayRepairIntegrationPaths
	, ownedTransferCopyReplayRepairModifiedPaths
	, ownedTransferCopyReplayRepairPredecessor
	, reverseOwnedTransferCopyReplayRepairUpdate
} from "./owned-transfer-copy-replay-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	ownedTransferCopyReplayRepairHistoryPath, "utf8"
));

test("owned transfer-copy replay repair restores every source", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-transfer-copy-replay-repair-source-v1");
	assert.equal(record.predecessorCommit
		, ownedTransferCopyReplayRepairPredecessor);
	assert.equal(record.implementationCommit
		, ownedTransferCopyReplayRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedTransferCopyReplayRepairModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedTransferCopyReplayRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedTransferCopyReplayRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
		);
		const previous = git(["show"
			, `${ownedTransferCopyReplayRepairPredecessor}:${update.path}`]);
		assert.equal(current, git(["show"
			, `${ownedTransferCopyReplayRepairImplementation}:${update.path}`])
			, update.path);
		assert.equal(reverseOwnedTransferCopyReplayRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
		);
		const previous = git(["show"
			, `${ownedTransferCopyReplayRepairImplementation}:${update.path}`]);
		assert.equal(reverseOwnedTransferCopyReplayRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("every transfer-copy path has one exact omitted transition", async () => {
	const record = await readRecord();
	assert.equal(record.historicalPredecessorCommit
		, ownedTransferCopyHistoricalPredecessor);
	assert.equal(record.historicalCommit, ownedTransferCopyHistoricalCommit);
	assert.equal(record.nativeFollowupCommit
		, ownedTransferCopyNativeFollowupCommit);
	assert.equal(record.historicalTransitions.length
		, ownedTransferCopyHistoricalPaths.length
			+ ownedTransferCopyNativeFollowupPaths.length
			+ ownedReplayHistoricalGapPaths.length);
	assert.deepEqual([...new Set(record.historicalTransitions.map(
		item => item.path
	))]
		, [...ownedReplayHistoricalGapPaths
			, ...ownedTransferCopyHistoricalPaths]);
	for(const transition of record.historicalTransitions)
	{
		const gap = ownedReplayHistoricalGapGroups.find(group =>
			group.currentCommit === transition.currentCommit
			&& group.paths.includes(transition.path)
		);
		const followup = transition.currentCommit
			=== ownedTransferCopyNativeFollowupCommit;
		if(gap === undefined)
		{
			assert.equal(transition.previousCommit, followup
				? ownedTransferCopyHistoricalCommit
				: ownedTransferCopyHistoricalPredecessor);
			assert.equal(transition.currentCommit, followup
				? ownedTransferCopyNativeFollowupCommit
				: ownedTransferCopyHistoricalCommit);
		}
		if(followup) assert.ok(ownedTransferCopyNativeFollowupPaths.includes(
			transition.path
		));
		const previous = git(["show"
			, `${transition.previousCommit}:${transition.path}`]);
		const current = git(["show"
			, `${transition.currentCommit}:${transition.path}`]);
		assert.equal(sha256(previous), transition.previousSha256);
		assert.equal(sha256(current), transition.currentSha256);
		assert.equal(reverseOwnedTransferCopyReplayRepairUpdate(
			current, transition), previous, transition.path);
		assert.equal(await sourceAtFinHistoryMilestone(
			transition.path, transition.currentSha256), current, transition.path);
		assert.equal(beforeFinRefinementSource(
			transition.path, current, transition.previousSha256)
			, previous, transition.path);
		assert.ok(finRefinementNormalizationPaths.includes(transition.path)
			, transition.path);
	}
});

test(
	"owned transfer-copy replay repair is one exact implementation commit"
	, () => {
	assert.equal(git(["rev-parse"
		, `${ownedTransferCopyReplayRepairImplementation}^`]).trim()
		, ownedTransferCopyReplayRepairPredecessor);
	assert.deepEqual(names(["diff", "--name-only"
		, ownedTransferCopyReplayRepairPredecessor
		, ownedTransferCopyReplayRepairImplementation])
		, [...ownedTransferCopyReplayRepairModifiedPaths].sort());
	}
);

test("owned transfer-copy replay repair rejects alteration", async () => {
	const record = await readRecord();
	const update = structuredClone(record.historicalTransitions[0]);
	const current = git(["show", `${update.currentCommit}:${update.path}`]);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedTransferCopyReplayRepairUpdate(
		current, forged
	));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseOwnedTransferCopyReplayRepairUpdate(
		current, shifted
	));
	assert.equal(beforeOwnedTransferCopyReplayRepairSource(
		update.path, `${current}unrelated\n`), `${current}unrelated\n`);
	assert.equal(beforeOwnedTransferCopyReplayRepairSource(
		"docs/unrelated.md", current), current);
});

test("owned transfer-copy replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-transfer-copy-replay-history-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-transfer-copy-replay-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
