/**
 * Authenticate the two omitted 3c22d43 Ruby transfer-copy test transitions.
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
	beforeRubyTransferCopyGapSource
	, reverseRubyTransferCopyGapUpdate
	, rubyTransferCopyGapAddedPaths
	, rubyTransferCopyGapHistoricalCommit
	, rubyTransferCopyGapHistoricalPaths
	, rubyTransferCopyGapHistoricalPredecessor
	, rubyTransferCopyGapHistoryPath
	, rubyTransferCopyGapPredecessor
} from "./ruby-transfer-copy-gap-source-history.mjs";
import {
	ownedReplayHistoricalGapPaths, ownedTransferCopyReplayRepairHistoryPath
} from "./owned-transfer-copy-replay-repair-source-history.mjs";
import {
	witTransferCopyGapHistoricalPaths
} from "./wit-transfer-copy-gap-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	rubyTransferCopyGapHistoryPath, "utf8"
));

test("Ruby transfer-copy gap records exactly the two omitted 3c22d43 transitions", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions", "historicalCommit"
		, "historicalPredecessorCommit", "historicalTransitions", "milestone"
		, "predecessorCommit", "schemaVersion", "scope"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "ruby-transfer-copy-gap-source-v1");
	assert.equal(record.predecessorCommit, rubyTransferCopyGapPredecessor);
	assert.equal(record.historicalPredecessorCommit
		, rubyTransferCopyGapHistoricalPredecessor);
	assert.equal(record.historicalCommit, rubyTransferCopyGapHistoricalCommit);
	assert.equal(git(["rev-parse", `${rubyTransferCopyGapHistoricalCommit}^`]).trim()
		, rubyTransferCopyGapHistoricalPredecessor);
	assert.deepEqual(record.historicalTransitions.map(item => item.path)
		, rubyTransferCopyGapHistoricalPaths);
	for(const transition of record.historicalTransitions)
	{
		assert.equal(transition.previousCommit, rubyTransferCopyGapHistoricalPredecessor);
		assert.equal(transition.currentCommit, rubyTransferCopyGapHistoricalCommit);
		const previous = git(["show", `${transition.previousCommit}:${transition.path}`]);
		const current = git(["show", `${transition.currentCommit}:${transition.path}`]);
		assert.equal(sha256(previous), transition.previousSha256, transition.path);
		assert.equal(sha256(current), transition.currentSha256, transition.path);
		assert.equal(reverseRubyTransferCopyGapUpdate(current, transition)
			, previous, transition.path);
		assert.equal(beforeRubyTransferCopyGapSource(transition.path, current)
			, previous, transition.path);
	}
});

test("Ruby transfer-copy gap completes 3c22d43 without overlapping other gap records", async () => {
	const replay = JSON.parse(await readFile(
		ownedTransferCopyReplayRepairHistoryPath, "utf8"
	));
	for(const path of rubyTransferCopyGapHistoricalPaths)
	{
		assert.ok(!ownedReplayHistoricalGapPaths.includes(path), path);
		assert.ok(!witTransferCopyGapHistoricalPaths.includes(path), path);
		assert.ok(!replay.historicalTransitions.some(item => item.path === path), path);
	}
	const changed = git(["diff", "--name-only"
		, rubyTransferCopyGapHistoricalPredecessor
		, rubyTransferCopyGapHistoricalCommit])
		.trim().split("\n").filter(Boolean).sort();
	const recorded = replay.historicalTransitions
		.filter(item => item.currentCommit === rubyTransferCopyGapHistoricalCommit)
		.map(item => item.path);
	assert.deepEqual([...recorded, ...rubyTransferCopyGapHistoricalPaths].sort()
		, changed);
});

test("Ruby transfer-copy gap additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, rubyTransferCopyGapAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("Ruby transfer-copy gap rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const transition of record.historicalTransitions)
	{
		const current = git(["show", `${transition.currentCommit}:${transition.path}`]);
		for(const changed of [{ ...transition, currentSha256: "0".repeat(64) }
			, { ...transition, previousSha256: "0".repeat(64) }
			, { ...transition, path: "unknown.mjs" }
			, { ...transition, edits: [] }
			, { ...transition, edits: [...transition.edits, transition.edits[0]] }])
			assert.throws(() => reverseRubyTransferCopyGapUpdate(current, changed));
		const shifted = structuredClone(transition);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseRubyTransferCopyGapUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeRubyTransferCopyGapSource(transition.path, unknown), unknown);
		assert.throws(() => reverseRubyTransferCopyGapUpdate(unknown, transition));
		assert.equal(beforeRubyTransferCopyGapSource("docs/unrelated.md", current), current);
	}
});

test("Ruby transfer-copy gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-ruby-transfer-copy-gap-"));
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
		"scripts/update-ruby-transfer-copy-gap-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
