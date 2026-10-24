/**
 * Authenticate the six omitted 1b77979 transfer-copy transitions.
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
	beforeWitTransferCopyGapSource
	, reverseWitTransferCopyGapUpdate
	, witTransferCopyGapAddedPaths
	, witTransferCopyGapHistoricalCommit
	, witTransferCopyGapHistoricalPaths
	, witTransferCopyGapHistoricalPredecessor
	, witTransferCopyGapHistoryPath
	, witTransferCopyGapIntegrationPaths
	, witTransferCopyGapPredecessor
} from "./wit-transfer-copy-gap-source-history.mjs";
import {
	ownedReplayHistoricalGapPaths, ownedTransferCopyReplayRepairHistoryPath
} from "./owned-transfer-copy-replay-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	witTransferCopyGapHistoryPath, "utf8"
));

test("WIT transfer-copy gap records exactly the six omitted 1b77979 transitions", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "wit-transfer-copy-gap-source-v1");
	assert.equal(record.predecessorCommit, witTransferCopyGapPredecessor);
	assert.equal(record.historicalPredecessorCommit
		, witTransferCopyGapHistoricalPredecessor);
	assert.equal(record.historicalCommit, witTransferCopyGapHistoricalCommit);
	assert.equal(git(["rev-parse", `${witTransferCopyGapHistoricalCommit}^`]).trim()
		, witTransferCopyGapHistoricalPredecessor);
	assert.deepEqual(record.historicalTransitions.map(item => item.path)
		, witTransferCopyGapHistoricalPaths);
	for(const transition of record.historicalTransitions)
	{
		assert.equal(transition.previousCommit, witTransferCopyGapHistoricalPredecessor);
		assert.equal(transition.currentCommit, witTransferCopyGapHistoricalCommit);
		const previous = git(["show", `${transition.previousCommit}:${transition.path}`]);
		const current = git(["show", `${transition.currentCommit}:${transition.path}`]);
		assert.equal(sha256(previous), transition.previousSha256, transition.path);
		assert.equal(sha256(current), transition.currentSha256, transition.path);
		assert.equal(reverseWitTransferCopyGapUpdate(current, transition)
			, previous, transition.path);
		assert.equal(beforeFinRefinementSource(
			transition.path, current, transition.previousSha256), previous, transition.path);
		assert.ok(finRefinementNormalizationPaths.includes(transition.path)
			, transition.path);
	}
});

test("WIT transfer-copy gap never overlaps the owned replay gap record", async () => {
	const replay = JSON.parse(await readFile(
		ownedTransferCopyReplayRepairHistoryPath, "utf8"
	));
	for(const path of witTransferCopyGapHistoricalPaths)
	{
		assert.ok(!ownedReplayHistoricalGapPaths.includes(path), path);
		assert.ok(!replay.historicalTransitions.some(item => item.path === path), path);
	}
	const changed = git(["diff", "--name-only"
		, witTransferCopyGapHistoricalPredecessor
		, witTransferCopyGapHistoricalCommit])
		.trim().split("\n").filter(Boolean).sort();
	const recorded = replay.historicalTransitions
		.filter(item => item.currentCommit === witTransferCopyGapHistoricalCommit)
		.map(item => item.path);
	assert.deepEqual([...recorded, ...witTransferCopyGapHistoricalPaths].sort(), changed);
});

test("WIT transfer-copy gap integration and additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, witTransferCopyGapIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, witTransferCopyGapAddedPaths);
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = git(["show", `${witTransferCopyGapPredecessor}:${update.path}`]);
		assert.equal(reverseWitTransferCopyGapUpdate(current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("WIT transfer-copy gap rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const transition of record.historicalTransitions)
	{
		const current = git(["show", `${transition.currentCommit}:${transition.path}`]);
		for(const changed of [{ ...transition, currentSha256: "0".repeat(64) }
			, { ...transition, previousSha256: "0".repeat(64) }
			, { ...transition, path: "unknown.mjs" }
			, { ...transition, edits: [] }
			, { ...transition, edits: [...transition.edits, transition.edits[0]] }])
			assert.throws(() => reverseWitTransferCopyGapUpdate(current, changed));
		const shifted = structuredClone(transition);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseWitTransferCopyGapUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeWitTransferCopyGapSource(transition.path, unknown), unknown);
		assert.throws(() => reverseWitTransferCopyGapUpdate(unknown, transition));
		assert.equal(beforeWitTransferCopyGapSource("docs/unrelated.md", current), current);
	}
});

test("WIT transfer-copy gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-wit-transfer-copy-gap-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-wit-transfer-copy-gap-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
