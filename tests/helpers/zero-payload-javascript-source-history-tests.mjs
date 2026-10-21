/**
 * Authenticate the zero-payload JavaScript surface milestone.
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
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeZeroPayloadJavaScriptSource
	, reverseZeroPayloadJavaScriptUpdate
	, zeroPayloadJavaScriptChangedPaths
	, zeroPayloadJavaScriptHistoryPath
	, zeroPayloadJavaScriptImplementation
	, zeroPayloadJavaScriptIntegrationPaths
	, zeroPayloadJavaScriptPredecessor
} from "./zero-payload-javascript-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const historyCommit = "319891d4d6b9c693d443dfa4a899adab6418db1f";

test("zero-payload JavaScript history restores every source", async () => {
	const record = JSON.parse(await readFile(zeroPayloadJavaScriptHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-javascript-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadJavaScriptPredecessor);
	assert.equal(record.implementationCommit, zeroPayloadJavaScriptImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path), zeroPayloadJavaScriptChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadJavaScriptIntegrationPaths);
	for(const update of record.updates)
	{
		const current = sourceAt(historyCommit, update.path);
		assert.equal(reverseZeroPayloadJavaScriptUpdate(current, update)
			, sourceAt(zeroPayloadJavaScriptPredecessor, update.path));
		assert.equal(beforeZeroPayloadJavaScriptSource(update.path, current)
			, sourceAt(zeroPayloadJavaScriptPredecessor, update.path));
		assert.equal(beforeZeroPayloadJavaScriptSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(zeroPayloadJavaScriptPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = sourceAt(historyCommit, update.path);
		assert.equal(reverseZeroPayloadJavaScriptUpdate(current, update)
			, sourceAt(zeroPayloadJavaScriptImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(sourceAt(historyCommit, addition.path))
			, addition.currentSha256, addition.path);
});

test("zero-payload JavaScript history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(zeroPayloadJavaScriptHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = sourceAt(historyCommit, update.path);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadJavaScriptUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadJavaScriptUpdate(current, update));
});

test("zero-payload JavaScript writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-js-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-javascript-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
