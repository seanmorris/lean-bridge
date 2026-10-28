/**
 * Authenticate central registration of the replay-chain memory bound.
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
	beforeReplayChainMemoryIntegrationSource
	, replayChainMemoryIntegrationAddedPaths
	, replayChainMemoryIntegrationBase
	, replayChainMemoryIntegrationHistoryPath
	, replayChainMemoryIntegrationPaths
	, reverseReplayChainMemoryIntegrationUpdate
} from "./replay-chain-memory-integration-source-history.mjs";
import { replayChainMemoryHistoryPath } from "./replay-chain-memory-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	replayChainMemoryIntegrationHistoryPath, "utf8"
));

test("Replay-chain memory integration restores its exact hub and partition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions", "baseHistory"
		, "integrationBaseCommit", "integrationUpdates", "milestone"
		, "schemaVersion", "scope"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "replay-chain-memory-integration-source-v1");
	assert.equal(record.integrationBaseCommit, replayChainMemoryIntegrationBase);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, replayChainMemoryIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, replayChainMemoryIntegrationAddedPaths);
	assert.deepEqual(record.baseHistory, {
		path: replayChainMemoryHistoryPath
		, sha256: sha256(await readFile(replayChainMemoryHistoryPath))
	});
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeReplayChainMemoryIntegrationSource);
		const previous = git(["show"
			, `${replayChainMemoryIntegrationBase}:${update.path}`]);
		assert.equal(reverseReplayChainMemoryIntegrationUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.equal(beforeReplayChainMemoryIntegrationSource(update.path
			, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Replay-chain memory integration rejects altered transitions", async () => {
	const record = await readRecord();
	const update = record.integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeReplayChainMemoryIntegrationSource);
	assert.throws(() => reverseReplayChainMemoryIntegrationUpdate(current
		, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforeReplayChainMemoryIntegrationSource(update.path
		, `${current}unknown\n`), `${current}unknown\n`);
});

test("Replay-chain memory integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-replay-chain-integration-"));
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
		"scripts/update-replay-chain-memory-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
