/**
 * Authenticate the complete optional-parameter publication lineage.
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
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeOptionalParameterCompletePromotionSource
	, optionalParameterCompletePromotionChangedPaths
	, optionalParameterCompletePromotionCommits
	, optionalParameterCompletePromotionCurrentSourcePaths
	, optionalParameterCompletePromotionHistoryAdditions
	, optionalParameterCompletePromotionHistoryPath
	, optionalParameterCompletePromotionImplementation
	, optionalParameterCompletePromotionIntegrationPaths
	, optionalParameterCompletePromotionPredecessor
	, reverseOptionalParameterCompletePromotionUpdate
} from "./optional-parameter-complete-promotion-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	optionalParameterCompletePromotionHistoryPath, "utf8"));

test("complete optional publication records its exact transaction", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"currentSourcePaths", "historyAdditions", "implementationCommit"
		, "implementationCommits", "integrationUpdates", "milestone"
		, "predecessorCommit", "refreshedPins", "schemaVersion", "scope"
		, "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "optional-parameter-complete-promotion-source-v1");
	assert.equal(record.predecessorCommit
		, optionalParameterCompletePromotionPredecessor);
	assert.equal(record.implementationCommit
		, optionalParameterCompletePromotionImplementation);
	assert.deepEqual(record.implementationCommits
		, optionalParameterCompletePromotionCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, optionalParameterCompletePromotionChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, optionalParameterCompletePromotionIntegrationPaths);
	assert.deepEqual(record.currentSourcePaths
		, optionalParameterCompletePromotionCurrentSourcePaths);
	assert.equal(record.refreshedPins, 70);
});

test("complete optional publication reverses every authenticated source"
	, async () => {
		const record = await readRecord();
		for(const update of record.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				optionalParameterCompletePromotionImplementation, update.path
			), update), true, update.path);
		for(const update of record.integrationUpdates)
		{
			const current = await readFile(update.path, "utf8");
			const previous = git(["show"
				, `${optionalParameterCompletePromotionImplementation}:${update.path}`]);
			assert.equal(reverseOptionalParameterCompletePromotionUpdate(
				current, update), previous, update.path);
			assert.equal(beforeOptionalParameterCompletePromotionSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("complete optional publication authenticates history controls", async () => {
	const record = await readRecord();
	assert.deepEqual(record.historyAdditions.map(item => item.path)
		, optionalParameterCompletePromotionHistoryAdditions);
	for(const addition of record.historyAdditions)
		assert.equal(sha256(await readFile(addition.path)), addition.sha256
			, addition.path);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${optionalParameterCompletePromotionPredecessor}..${optionalParameterCompletePromotionImplementation}`])
		.trim().split("\n"), optionalParameterCompletePromotionCommits);
});

test("complete optional publication rejects forged transitions", async () => {
	const update = (await readRecord()).updates.find(item =>
		item.path !== "docs/type-surface.v1.json");
	const current = git(["show"
		, `${optionalParameterCompletePromotionImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseOptionalParameterCompletePromotionUpdate(current, forged));
});

test("complete optional publication writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-optional-complete-promotion-history-test-"));
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
		"scripts/update-optional-parameter-complete-promotion-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.deepEqual(await readdir(root), [".git"]);
});
