/**
 * Authenticate the zero-payload native PHP package source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeZeroPayloadPhpHistorySource
	, zeroPayloadPhpHistoryApplicationPaths
	, zeroPayloadPhpHistoryChangedPaths
	, zeroPayloadPhpHistoryHistoryPath
	, zeroPayloadPhpHistoryImplementation
	, zeroPayloadPhpHistoryIntegrationPaths
	, zeroPayloadPhpHistoryPredecessor
	, reverseZeroPayloadPhpHistoryUpdate
} from "./zero-payload-php-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

test("zero-payload native PHP history restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadPhpHistoryHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-php-source-v1");
	assert.equal(record.predecessorCommit
		, zeroPayloadPhpHistoryPredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadPhpHistoryImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadPhpHistoryChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadPhpHistoryIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseZeroPayloadPhpHistoryUpdate(current, update);
		assert.equal(previous, sourceAt(
			zeroPayloadPhpHistoryImplementation, update.path
		));
		assert.equal(beforeZeroPayloadPhpHistorySource(
			update.path, current), previous);
		assert.equal(beforeZeroPayloadPhpHistorySource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeZeroPayloadPhpHistorySource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseZeroPayloadPhpHistoryUpdate(current, update)
			, sourceAt(zeroPayloadPhpHistoryImplementation, update.path));
	}
	assert.deepEqual(record.additions.slice(0
		, zeroPayloadPhpHistoryApplicationPaths.length).map(item => item.path)
	, [...zeroPayloadPhpHistoryApplicationPaths]);
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("zero-payload native PHP history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadPhpHistoryHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await readFile(update.path, "utf8");
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadPhpHistoryUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadPhpHistoryUpdate(current, update));
});

test("zero-payload native PHP writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-php-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-php-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
