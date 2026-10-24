/**
 * Check the exact producer pin refresh without parsing the large inventory.
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
	beforeDotnetCallbackProducerReplaySource
	, dotnetCallbackProducerReplayAddedPaths
	, dotnetCallbackProducerReplayChangedPaths
	, dotnetCallbackProducerReplayCommits
	, dotnetCallbackProducerReplayImplementationPaths
	, dotnetCallbackProducerReplayHistoryPath
	, dotnetCallbackProducerReplayImplementation
	, dotnetCallbackProducerReplayIntegrationBase
	, dotnetCallbackProducerReplayIntegrationPaths
	, dotnetCallbackProducerReplayPredecessor
	, reverseDotnetCallbackProducerReplayUpdate
} from "./dotnet-callback-producer-replay-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	dotnetCallbackProducerReplayHistoryPath, "utf8"));

test(".NET callback replay authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "dotnet-callback-producer-replay-source-v1");
	assert.equal(record.predecessorCommit, dotnetCallbackProducerReplayPredecessor);
	assert.equal(record.implementationCommit, dotnetCallbackProducerReplayImplementation);
	assert.equal(record.integrationBaseCommit, dotnetCallbackProducerReplayIntegrationBase);
	assert.deepEqual(record.implementationCommits, dotnetCallbackProducerReplayCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, dotnetCallbackProducerReplayChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dotnetCallbackProducerReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, dotnetCallbackProducerReplayAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, dotnetCallbackProducerReplayPredecessor + ".." + dotnetCallbackProducerReplayImplementation]).trim().split("\n")
	, dotnetCallbackProducerReplayCommits);
	for(const [index, revision] of dotnetCallbackProducerReplayCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? dotnetCallbackProducerReplayPredecessor : dotnetCallbackProducerReplayCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, dotnetCallbackProducerReplayPredecessor
		, dotnetCallbackProducerReplayImplementation]).trim().split("\n")
	, [...dotnetCallbackProducerReplayImplementationPaths].sort());
	const updates = [...record.updates
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeDotnetCallbackProducerReplaySource);
		const prior = record.integrationUpdates.includes(update)
			? dotnetCallbackProducerReplayIntegrationBase : dotnetCallbackProducerReplayPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseDotnetCallbackProducerReplayUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test(".NET callback replay rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeDotnetCallbackProducerReplaySource);
	assert.equal(beforeDotnetCallbackProducerReplaySource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeDotnetCallbackProducerReplaySource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseDotnetCallbackProducerReplayUpdate(current, forged));
	assert.equal(beforeDotnetCallbackProducerReplaySource(
		"unrelated.mjs", current), current);
});

test(".NET callback replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-dotnet-callback-replay-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dotnet-callback-producer-replay-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
