/**
 * Authenticate the omitted c5a8723 zero-payload .NET archiver transition.
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
	beforeZeroPayloadDotnetArchiveGapSource
	, reverseZeroPayloadDotnetArchiveGapUpdate
	, zeroPayloadDotnetArchiveGapAddedPaths
	, zeroPayloadDotnetArchiveGapHistoricalCommit
	, zeroPayloadDotnetArchiveGapHistoricalPaths
	, zeroPayloadDotnetArchiveGapHistoricalPredecessor
	, zeroPayloadDotnetArchiveGapHistoryPath
	, zeroPayloadDotnetArchiveGapPredecessor
} from "./zero-payload-dotnet-archive-gap-source-history.mjs";
import {
	zeroPayloadDotnetArchiveHistoryPath
} from "./zero-payload-dotnet-archive-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	zeroPayloadDotnetArchiveGapHistoryPath, "utf8"
));

test("zero-payload .NET archive gap records exactly the omitted c5a8723 transition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions", "historicalCommit"
		, "historicalPredecessorCommit", "historicalTransitions", "milestone"
		, "predecessorCommit", "schemaVersion", "scope"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-dotnet-archive-gap-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadDotnetArchiveGapPredecessor);
	assert.equal(record.historicalPredecessorCommit
		, zeroPayloadDotnetArchiveGapHistoricalPredecessor);
	assert.equal(record.historicalCommit, zeroPayloadDotnetArchiveGapHistoricalCommit);
	assert.equal(git(["rev-parse", `${zeroPayloadDotnetArchiveGapHistoricalCommit}^`]).trim()
		, zeroPayloadDotnetArchiveGapHistoricalPredecessor);
	assert.deepEqual(record.historicalTransitions.map(item => item.path)
		, zeroPayloadDotnetArchiveGapHistoricalPaths);
	for(const transition of record.historicalTransitions)
	{
		assert.equal(transition.previousCommit, zeroPayloadDotnetArchiveGapHistoricalPredecessor);
		assert.equal(transition.currentCommit, zeroPayloadDotnetArchiveGapHistoricalCommit);
		const previous = git(["show", `${transition.previousCommit}:${transition.path}`]);
		const current = git(["show", `${transition.currentCommit}:${transition.path}`]);
		assert.equal(sha256(previous), transition.previousSha256, transition.path);
		assert.equal(sha256(current), transition.currentSha256, transition.path);
		assert.equal(reverseZeroPayloadDotnetArchiveGapUpdate(current, transition)
			, previous, transition.path);
		assert.equal(beforeZeroPayloadDotnetArchiveGapSource(transition.path, current)
			, previous, transition.path);
	}
});

test("zero-payload .NET archive gap completes c5a8723 without overlapping its archive record", async () => {
	const archive = JSON.parse(await readFile(
		zeroPayloadDotnetArchiveHistoryPath, "utf8"
	));
	const record = await readRecord();
	for(const transition of record.historicalTransitions)
		for(const category of ["updates", "integrationUpdates", "additions"])
			assert.ok(!(archive[category] ?? []).some(item =>
				item.path === transition.path
				&& item.currentSha256 === transition.currentSha256)
			, `${category}:${transition.path}`);
	const changed = git(["diff", "--name-only"
		, zeroPayloadDotnetArchiveGapHistoricalPredecessor
		, zeroPayloadDotnetArchiveGapHistoricalCommit])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(changed, [...zeroPayloadDotnetArchiveGapHistoricalPaths].sort());
	// The archive record's addition is the predecessor side of this transition.
	for(const transition of record.historicalTransitions)
		assert.ok(archive.additions.some(item => item.path === transition.path
			&& item.currentSha256 === transition.previousSha256), transition.path);
});

test("zero-payload .NET archive gap additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, zeroPayloadDotnetArchiveGapAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("zero-payload .NET archive gap rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const transition of record.historicalTransitions)
	{
		const current = git(["show", `${transition.currentCommit}:${transition.path}`]);
		for(const changed of [{ ...transition, currentSha256: "0".repeat(64) }
			, { ...transition, previousSha256: "0".repeat(64) }
			, { ...transition, path: "unknown.mjs" }
			, { ...transition, edits: [] }
			, { ...transition, edits: [...transition.edits, transition.edits[0]] }])
			assert.throws(() => reverseZeroPayloadDotnetArchiveGapUpdate(current, changed));
		const shifted = structuredClone(transition);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseZeroPayloadDotnetArchiveGapUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeZeroPayloadDotnetArchiveGapSource(transition.path, unknown), unknown);
		assert.throws(() => reverseZeroPayloadDotnetArchiveGapUpdate(unknown, transition));
		assert.equal(beforeZeroPayloadDotnetArchiveGapSource("docs/unrelated.md", current), current);
	}
});

test("zero-payload .NET archive gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-zero-payload-dotnet-archive-gap-"));
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
		"scripts/update-zero-payload-dotnet-archive-gap-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
