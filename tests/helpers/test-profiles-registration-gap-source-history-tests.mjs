/**
 * Authenticate the omitted tests/test-profiles.test.mjs transitions.
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
	beforeTestProfilesRegistrationGapHistoricalSource
	, beforeTestProfilesRegistrationGapSource
	, reverseTestProfilesRegistrationGapHistoricalUpdate
	, reverseTestProfilesRegistrationGapUpdate
	, testProfilesRegistrationGapAddedPaths
	, testProfilesRegistrationGapHistoricalPaths
	, testProfilesRegistrationGapHistoryPath
	, testProfilesRegistrationGapIntegrationPaths
	, testProfilesRegistrationGapPredecessor
	, testProfilesRegistrationGapTransitions
} from "./test-profiles-registration-gap-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const record = async () => JSON.parse(await readFile(
	testProfilesRegistrationGapHistoryPath, "utf8"));
// The 2026-10-06 test-profile registration milestone of this file.
const registrationMilestone
	= "11838692c215b00028c96565cbbbb4a547f863ec4e37dcbc4d378bfdd0a1d2f3";

test("test-profiles registration gap history restores every source", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "test-profiles-registration-gap-v1");
	assert.equal(history.predecessorCommit, testProfilesRegistrationGapPredecessor);
	assert.deepEqual(history.historicalTransitions.map(item =>
		[item.path, item.previousCommit, item.currentCommit])
	, testProfilesRegistrationGapTransitions.map(item =>
		[item.path, item.previousCommit, item.currentCommit]));
	for(const update of history.historicalTransitions)
	{
		const current = git(["show", `${update.currentCommit}:${update.path}`]);
		const previous = git(["show", `${update.previousCommit}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.currentCommit);
		assert.equal(reverseTestProfilesRegistrationGapHistoricalUpdate(current, update)
			, previous, update.currentCommit);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256)
			, previous, update.currentCommit);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	assert.equal(history.historicalTransitions[0].previousSha256
		, history.historicalTransitions[1].currentSha256);
	assert.equal(history.historicalTransitions[1].previousSha256, registrationMilestone);
	// The live file now reaches the registration milestone through the hub.
	const path = testProfilesRegistrationGapHistoricalPaths[0];
	assert.equal(sha256(await sourceAtFinHistoryMilestone(path, registrationMilestone))
		, registrationMilestone);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, testProfilesRegistrationGapIntegrationPaths);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeTestProfilesRegistrationGapSource);
		assert.equal(reverseTestProfilesRegistrationGapUpdate(current, update)
			, git(["show", `${testProfilesRegistrationGapPredecessor}:${update.path}`])
			, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	assert.deepEqual(history.additions.map(item => item.path)
		, testProfilesRegistrationGapAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("test-profiles registration gap history range is exact", async () => {
	for(const item of testProfilesRegistrationGapTransitions)
		assert.equal(git(["rev-parse", `${item.currentCommit}^`]).trim().length, 40);
	for(const path of testProfilesRegistrationGapAddedPaths)
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${testProfilesRegistrationGapPredecessor}:${path}`], { stdio: "ignore" }).status
		, 0, path);
	assert.equal(git(["cat-file", "-t", testProfilesRegistrationGapPredecessor]).trim()
		, "commit");
});

test("test-profiles registration gap history rejects alterations", async () => {
	const history = await record();
	const update = structuredClone(history.historicalTransitions[0]);
	const current = git(["show", `${update.currentCommit}:${update.path}`]);
	assert.throws(() => reverseTestProfilesRegistrationGapHistoricalUpdate(current
		, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseTestProfilesRegistrationGapHistoricalUpdate(current
		, { ...update, previousSha256: "0".repeat(64) }));
	assert.throws(() => reverseTestProfilesRegistrationGapHistoricalUpdate(current
		, { ...update, path: "src/adoption/test-profiles.mjs" }));
	const changed = `${current}\n// unrelated edit\n`;
	assert.equal(beforeTestProfilesRegistrationGapHistoricalSource(update.path, changed), changed);
	assert.equal(beforeTestProfilesRegistrationGapHistoricalSource(
		"src/adoption/test-profiles.mjs", current), current);
	const integration = history.integrationUpdates[0];
	const live = await readFile(integration.path, "utf8");
	assert.equal(beforeTestProfilesRegistrationGapSource(integration.path
		, `${live}\n// unrelated edit\n`), `${live}\n// unrelated edit\n`);
	assert.throws(() => reverseTestProfilesRegistrationGapUpdate(live
		, { ...integration, currentSha256: "0".repeat(64) }));
});

test("test-profiles registration gap history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-test-profiles-registration-gap-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-test-profiles-registration-gap-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
