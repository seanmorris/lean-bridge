/**
 * Authenticate the zero-payload Rust installed acceptance milestone.
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
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeZeroPayloadRustInstalledSource
	, reverseZeroPayloadRustInstalledUpdate
	, zeroPayloadRustInstalledChangedPaths, zeroPayloadRustInstalledHistoryPath
	, zeroPayloadRustInstalledImplementation
	, zeroPayloadRustInstalledIntegrationPaths
	, zeroPayloadRustInstalledPredecessor
} from "./zero-payload-rust-installed-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("zero-payload Rust installed history restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadRustInstalledHistoryPath, "utf8"
	));
	assert.equal(record.milestone, "zero-payload-rust-installed-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadRustInstalledPredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadRustInstalledImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadRustInstalledChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadRustInstalledIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadRustInstalledSource
		);
		assert.equal(reverseZeroPayloadRustInstalledUpdate(current, update)
			, sourceAt(zeroPayloadRustInstalledPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256
		), sourceAt(zeroPayloadRustInstalledPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadRustInstalledSource
		);
		assert.equal(reverseZeroPayloadRustInstalledUpdate(current, update)
			, sourceAt(zeroPayloadRustInstalledImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});
test("zero-payload Rust installed history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadRustInstalledHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeZeroPayloadRustInstalledSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadRustInstalledUpdate(current, update));
});

test("zero-payload Rust installed writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-rust-installed-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, {
		cwd: root, env, stdio: "pipe"
	});
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-rust-installed-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
