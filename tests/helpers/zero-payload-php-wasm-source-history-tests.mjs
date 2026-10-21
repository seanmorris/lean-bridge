/**
 * Authenticate the zero-payload PHP-Wasm package source milestone.
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
	beforeZeroPayloadPhpWasmHistorySource
	, zeroPayloadPhpWasmHistoryApplicationPaths
	, zeroPayloadPhpWasmHistoryChangedPaths
	, zeroPayloadPhpWasmHistoryHistoryPath
	, zeroPayloadPhpWasmHistoryImplementation
	, zeroPayloadPhpWasmHistoryIntegrationPaths
	, zeroPayloadPhpWasmHistoryPredecessor
	, reverseZeroPayloadPhpWasmHistoryUpdate
} from "./zero-payload-php-wasm-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

test("zero-payload PHP-Wasm history restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadPhpWasmHistoryHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-php-wasm-source-v1");
	assert.equal(record.predecessorCommit
		, zeroPayloadPhpWasmHistoryPredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadPhpWasmHistoryImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadPhpWasmHistoryChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadPhpWasmHistoryIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseZeroPayloadPhpWasmHistoryUpdate(current, update);
		assert.equal(previous, sourceAt(
			zeroPayloadPhpWasmHistoryImplementation, update.path
		));
		assert.equal(beforeZeroPayloadPhpWasmHistorySource(
			update.path, current), previous);
		assert.equal(beforeZeroPayloadPhpWasmHistorySource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeZeroPayloadPhpWasmHistorySource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseZeroPayloadPhpWasmHistoryUpdate(current, update)
			, sourceAt(zeroPayloadPhpWasmHistoryImplementation, update.path));
	}
	assert.deepEqual(record.additions.slice(0
		, zeroPayloadPhpWasmHistoryApplicationPaths.length).map(item => item.path)
	, [...zeroPayloadPhpWasmHistoryApplicationPaths]);
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("zero-payload PHP-Wasm history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadPhpWasmHistoryHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await readFile(update.path, "utf8");
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadPhpWasmHistoryUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadPhpWasmHistoryUpdate(current, update));
});

test("zero-payload PHP-Wasm writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-php-wasm-guard-"
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
		"scripts/update-zero-payload-php-wasm-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
