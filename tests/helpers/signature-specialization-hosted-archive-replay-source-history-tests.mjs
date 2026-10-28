/**
 * Authenticate the immutable hosted-signature archive and replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	beforeSignatureSpecializationHostedArchiveReplaySource
	, reverseSignatureSpecializationHostedArchiveReplayUpdate
	, signatureSpecializationHostedArchiveReplayAddedPaths
	, signatureSpecializationHostedArchiveReplayChangedPaths
	, signatureSpecializationHostedArchiveReplayHistoryPath
	, signatureSpecializationHostedArchiveReplayImplementation
	, signatureSpecializationHostedArchiveReplayPredecessor
	, signatureSpecializationHostedArchiveReplayRoot
} from "./signature-specialization-hosted-archive-replay-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationHostedArchiveReplayHistoryPath, "utf8"
));

test("hosted signature archive replay repair restores its exact source", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "archive", "implementationCommit", "milestone"
		, "predecessorCommit", "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "signature-specialization-hosted-archive-replay-source-v1");
	assert.equal(record.predecessorCommit
		, signatureSpecializationHostedArchiveReplayPredecessor);
	assert.equal(record.implementationCommit
		, signatureSpecializationHostedArchiveReplayImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationHostedArchiveReplayChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${signatureSpecializationHostedArchiveReplayPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${signatureSpecializationHostedArchiveReplayImplementation}:${update.path}`]);
		assert.equal(reverseSignatureSpecializationHostedArchiveReplayUpdate(
			current, update), previous, update.path);
		assert.equal(beforeSignatureSpecializationHostedArchiveReplaySource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("hosted signature archive ledger covers its exact canonical tree", async () => {
	const record = await readRecord();
	const indexPath = `${signatureSpecializationHostedArchiveReplayRoot}/index.json`;
	const indexBytes = Buffer.from(git(["show"
		, `${signatureSpecializationHostedArchiveReplayImplementation}:${indexPath}`]));
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	const expected = [
		indexPath
		, ...index.files.map(file =>
			`${signatureSpecializationHostedArchiveReplayRoot}/${file.path}`)
	].sort();
	assert.deepEqual(names(["ls-tree", "-r", "--name-only"
		, signatureSpecializationHostedArchiveReplayImplementation, "--"
		, signatureSpecializationHostedArchiveReplayRoot]), expected);
	assert.deepEqual(record.archive, {
		path: indexPath, bytes: indexBytes.length
		, sha256: sha256(indexBytes), files: expected.length
	});
	assert.equal(expected.length, 5726);
	assert.equal(index.lanes.length, 10);
});

test("hosted signature archive replay additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationHostedArchiveReplayAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("hosted signature archive replay rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${signatureSpecializationHostedArchiveReplayImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseSignatureSpecializationHostedArchiveReplayUpdate(
			current, forged));
});

test("hosted signature archive-replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-signature-hosted-archive-replay-history-"));
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
		"scripts/update-signature-specialization-hosted-archive-replay-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
