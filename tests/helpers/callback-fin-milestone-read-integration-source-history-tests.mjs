/**
 * Authenticate central registration of the callback Fin milestone-read history.
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
	beforeCallbackFinMilestoneReadIntegrationSource
	, callbackFinMilestoneReadIntegrationAddedPaths
	, callbackFinMilestoneReadIntegrationBase
	, callbackFinMilestoneReadIntegrationHistoryPath
	, callbackFinMilestoneReadIntegrationImplementation
	, callbackFinMilestoneReadIntegrationPaths
	, reverseCallbackFinMilestoneReadIntegrationUpdate
} from "./callback-fin-milestone-read-integration-source-history.mjs";
import { callbackFinMilestoneReadHistoryPath } from "./callback-fin-milestone-read-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	callbackFinMilestoneReadIntegrationHistoryPath, "utf8"
));

test("callback Fin milestone-read integration restores its exact hub and partition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "baseHistory", "baseCommit", "implementationCommit"
		, "milestone", "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-fin-milestone-read-integration-v1");
	assert.equal(record.baseCommit, callbackFinMilestoneReadIntegrationBase);
	assert.equal(record.implementationCommit
		, callbackFinMilestoneReadIntegrationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackFinMilestoneReadIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackFinMilestoneReadIntegrationAddedPaths);
	assert.deepEqual(record.baseHistory, {
		path: callbackFinMilestoneReadHistoryPath
		, sha256: sha256(await readFile(callbackFinMilestoneReadHistoryPath))
	});
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackFinMilestoneReadIntegrationSource);
		const previous = git(["show"
			, `${callbackFinMilestoneReadIntegrationBase}:${update.path}`]);
		assert.equal(reverseCallbackFinMilestoneReadIntegrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.equal(beforeCallbackFinMilestoneReadIntegrationSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("callback Fin milestone-read integration rejects altered transitions", async () => {
	const record = await readRecord();
	const update = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCallbackFinMilestoneReadIntegrationSource);
	assert.throws(() => reverseCallbackFinMilestoneReadIntegrationUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforeCallbackFinMilestoneReadIntegrationSource(update.path
		, `${current}unknown\n`), `${current}unknown\n`);
});

test("callback Fin milestone-read integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-fin-milestone-read-integration-"));
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
		"scripts/update-callback-fin-milestone-read-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration implementation/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
