/**
 * Authenticate the Core memory bound on the JVM and .NET process replay chain:
 * the exact receipt-hash links that replace in-process predecessor replay.
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
	beforeReplayChainMemorySource
	, replayChainMemoryAddedPaths
	, replayChainMemoryChangedPaths
	, replayChainMemoryCommits
	, replayChainMemoryHistoryPath
	, replayChainMemoryImplementation
	, replayChainMemoryImplementationAddedPaths
	, replayChainMemoryPredecessor
	, reverseReplayChainMemoryUpdate
} from "./replay-chain-memory-source-history.mjs";
import { assertManagedCiIsolationEvidence } from "./managed-ci-isolation-evidence.mjs";
import { managedCiIsolationPath } from "./managed-ci-isolation-history.mjs";
import { assertNativeForkRepair, assertNativeForkRepairPredecessorReplay } from "./native-fork-repair-evidence.mjs";
import { nativeForkRepairPath } from "./native-fork-repair-history.mjs";
import { assertOwnedDotnetProcess } from "./owned-dotnet-process-evidence.mjs";
import { ownedDotnetProcessPath } from "./owned-dotnet-process-history.mjs";
import { ownedDotnetHistoryPath } from "./owned-dotnet-source-history.mjs";
import { assertOwnedJvmPackageIntegration } from "./owned-jvm-package-evidence.mjs";
import { ownedJvmHistoryPath } from "./owned-jvm-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	replayChainMemoryHistoryPath, "utf8"
));
const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Replay-chain memory bound records exactly its implementation transitions", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "implementationCommits", "milestone"
		, "predecessorCommit"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "replay-chain-memory-source-v1");
	assert.equal(record.predecessorCommit, replayChainMemoryPredecessor);
	assert.equal(record.implementationCommit
		, replayChainMemoryImplementation);
	assert.deepEqual(record.implementationCommits, replayChainMemoryCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${replayChainMemoryPredecessor}..${replayChainMemoryImplementation}`])
		.trim().split("\n"), replayChainMemoryCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, replayChainMemoryPredecessor
		, replayChainMemoryImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...replayChainMemoryChangedPaths
		, ...replayChainMemoryImplementationAddedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, replayChainMemoryChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${replayChainMemoryPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${replayChainMemoryImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseReplayChainMemoryUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeReplayChainMemorySource(update.path, current)
			, previous, update.path);
		assert.equal(beforeReplayChainMemorySource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("Replay-chain memory bound additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, replayChainMemoryAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("Replay-chain memory bound rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${replayChainMemoryImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseReplayChainMemoryUpdate(current, changed));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseReplayChainMemoryUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeReplayChainMemorySource(update.path, unknown), unknown);
		assert.throws(() => reverseReplayChainMemoryUpdate(unknown, update));
		assert.equal(beforeReplayChainMemorySource("docs/unrelated.md", current)
			, current);
	}
});

test("replay-chain verifiers pin each predecessor by exact receipt hash", async () => {
	const links = [
		[ownedJvmHistoryPath, managedCiIsolationPath, assertOwnedJvmPackageIntegration]
		, [managedCiIsolationPath, nativeForkRepairPath, assertManagedCiIsolationEvidence]
		, [nativeForkRepairPath, ownedDotnetProcessPath, assertNativeForkRepair]
		, [nativeForkRepairPath, ownedDotnetProcessPath, assertNativeForkRepairPredecessorReplay]
		, [ownedDotnetProcessPath, ownedDotnetHistoryPath, assertOwnedDotnetProcess]
	];
	for(const [path, previousPath, verify] of links)
	{
		const record = await json(path);
		assert.equal(record.previous.path, previousPath, path);
		assert.equal(sha256(await readFile(previousPath)), record.previous.sha256, path);
		for(const [key, value] of [["sha256", "0".repeat(64)], ["path", ownedJvmHistoryPath]])
		{
			const previous = { ...record.previous, [key]: value };
			await assert.rejects(verify({ ...record, previous })
				, error => error instanceof assert.AssertionError
					&& JSON.stringify(error.actual).includes(value), `${verify.name} ${key}`);
		}
	}
});

test("Replay-chain memory bound writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-replay-chain-memory-"));
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
		"scripts/update-replay-chain-memory-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
