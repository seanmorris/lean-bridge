/**
 * Authenticate the zero-payload npm adapter foundation.
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
	beforeZeroPayloadNpmFoundationSource
	, reverseZeroPayloadNpmFoundationUpdate
	, zeroPayloadNpmFoundationChangedPaths
	, zeroPayloadNpmFoundationHistoryPath
	, zeroPayloadNpmFoundationImplementation
	, zeroPayloadNpmFoundationIntegrationPaths
	, zeroPayloadNpmFoundationPredecessor
} from "./zero-payload-npm-foundation-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("zero-payload npm foundation history restores every source", async () => {
	const record = JSON.parse(await readFile(zeroPayloadNpmFoundationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-npm-foundation-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadNpmFoundationPredecessor);
	assert.equal(record.implementationCommit, zeroPayloadNpmFoundationImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path), zeroPayloadNpmFoundationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadNpmFoundationIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseZeroPayloadNpmFoundationUpdate(current, update);
		assert.equal(previous, sourceAt(zeroPayloadNpmFoundationPredecessor, update.path));
		assert.equal(beforeZeroPayloadNpmFoundationSource(update.path, current), previous);
		assert.equal(beforeZeroPayloadNpmFoundationSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseZeroPayloadNpmFoundationUpdate(current, update)
			, sourceAt(zeroPayloadNpmFoundationImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path)), addition.currentSha256, addition.path);
});

test("zero-payload npm foundation history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(zeroPayloadNpmFoundationHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await readFile(update.path, "utf8");
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadNpmFoundationUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadNpmFoundationUpdate(current, update));
});

test("zero-payload npm foundation writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-npm-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-npm-foundation-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
