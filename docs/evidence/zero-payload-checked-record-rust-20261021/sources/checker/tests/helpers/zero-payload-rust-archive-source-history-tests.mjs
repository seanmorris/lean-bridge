/**
 * Authenticate the zero-payload Rust verifier and archiver milestone.
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
	beforeZeroPayloadRustArchiveSource
	, reverseZeroPayloadRustArchiveUpdate
	, zeroPayloadRustArchiveChangedPaths, zeroPayloadRustArchiveHistoryPath
	, zeroPayloadRustArchiveImplementation
	, zeroPayloadRustArchiveIntegrationPaths
	, zeroPayloadRustArchivePredecessor
} from "./zero-payload-rust-archive-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("zero-payload Rust archive history restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadRustArchiveHistoryPath, "utf8"
	));
	assert.equal(record.milestone, "zero-payload-rust-archive-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadRustArchivePredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadRustArchiveImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadRustArchiveChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadRustArchiveIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadRustArchiveSource
		);
		assert.equal(reverseZeroPayloadRustArchiveUpdate(current, update)
			, sourceAt(zeroPayloadRustArchivePredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256
		), sourceAt(zeroPayloadRustArchivePredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadRustArchiveSource
		);
		assert.equal(reverseZeroPayloadRustArchiveUpdate(current, update)
			, sourceAt(zeroPayloadRustArchiveImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});
test("zero-payload Rust archive history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadRustArchiveHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeZeroPayloadRustArchiveSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadRustArchiveUpdate(current, update));
});

test("zero-payload Rust archive writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-rust-archive-"
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
		"scripts/update-zero-payload-rust-archive-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
