/**
 * Authenticate the zero-payload browser execution milestone.
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
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeZeroPayloadBrowserSource
	, reverseZeroPayloadBrowserUpdate
	, zeroPayloadBrowserChangedPaths
	, zeroPayloadBrowserHistoryPath
	, zeroPayloadBrowserImplementation
	, zeroPayloadBrowserIntegrationPaths
	, zeroPayloadBrowserPredecessor
} from "./zero-payload-browser-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("zero-payload browser history restores every source", async () => {
	const record = JSON.parse(await readFile(zeroPayloadBrowserHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-browser-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadBrowserPredecessor);
	assert.equal(record.implementationCommit, zeroPayloadBrowserImplementation);
	assert.equal(record.reconciledTypeSurfacePointers, 0);
	assert.deepEqual(record.updates.map(item => item.path), zeroPayloadBrowserChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadBrowserIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeZeroPayloadBrowserSource
		);
		assert.equal(reverseZeroPayloadBrowserUpdate(current, update)
			, sourceAt(zeroPayloadBrowserPredecessor, update.path));
		assert.equal(beforeZeroPayloadBrowserSource(update.path, current)
			, sourceAt(zeroPayloadBrowserPredecessor, update.path));
		assert.equal(beforeZeroPayloadBrowserSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(zeroPayloadBrowserPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeZeroPayloadBrowserSource
		);
		assert.equal(reverseZeroPayloadBrowserUpdate(current, update)
			, sourceAt(zeroPayloadBrowserImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("zero-payload browser history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(zeroPayloadBrowserHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeZeroPayloadBrowserSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadBrowserUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadBrowserUpdate(current, update));
});

test("zero-payload browser writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-browser-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-browser-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
