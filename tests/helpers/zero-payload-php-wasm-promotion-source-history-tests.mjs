/**
 * Authenticate the hosted zero-payload PHP-Wasm promotion milestone.
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
	sourceAtFinHistoryMilestone
} from "./source-at-fin-history-milestone.mjs";
import {
	beforeZeroPayloadPhpWasmPromotionSource
	, reverseZeroPayloadPhpWasmPromotionUpdate
	, zeroPayloadPhpWasmPromotionChangedPaths
	, zeroPayloadPhpWasmPromotionHistoryPath
	, zeroPayloadPhpWasmPromotionImplementation
	, zeroPayloadPhpWasmPromotionIntegrationPaths
	, zeroPayloadPhpWasmPromotionPredecessor
} from "./zero-payload-php-wasm-promotion-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("zero-payload PHP-Wasm promotion history restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadPhpWasmPromotionHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "zero-payload-php-wasm-promotion-source-v1");
	assert.equal(record.predecessorCommit
		, zeroPayloadPhpWasmPromotionPredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadPhpWasmPromotionImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadPhpWasmPromotionChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadPhpWasmPromotionIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadPhpWasmPromotionSource);
		assert.equal(reverseZeroPayloadPhpWasmPromotionUpdate(current, update)
			, sourceAt(zeroPayloadPhpWasmPromotionPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(zeroPayloadPhpWasmPromotionPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadPhpWasmPromotionSource);
		assert.equal(reverseZeroPayloadPhpWasmPromotionUpdate(current, update)
			, sourceAt(zeroPayloadPhpWasmPromotionImplementation, update.path));
	}
});

test("zero-payload PHP-Wasm promotion history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadPhpWasmPromotionHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeZeroPayloadPhpWasmPromotionSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadPhpWasmPromotionUpdate(
		current, update));
});

test("zero-payload PHP-Wasm promotion writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-zero-payload-php-wasm-promotion-"));
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
		"scripts/update-zero-payload-php-wasm-promotion-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
