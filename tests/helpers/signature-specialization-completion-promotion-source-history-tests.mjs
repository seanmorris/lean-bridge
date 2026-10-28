/**
 * Authenticate the hosted-signature type-surface promotion transaction.
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
	beforeSignatureSpecializationCompletionPromotionSource
	, reverseSignatureSpecializationCompletionPromotionUpdate
	, signatureSpecializationCompletionPromotionAddedPaths
	, signatureSpecializationCompletionPromotionChangedPaths
	, signatureSpecializationCompletionPromotionCommits
	, signatureSpecializationCompletionPromotionHistoryPath
	, signatureSpecializationCompletionPromotionImplementation
	, signatureSpecializationCompletionPromotionPredecessor
} from "./signature-specialization-completion-promotion-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationCompletionPromotionHistoryPath, "utf8"
));

test("signature completion promotion records its exact transaction", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "implementationCommit", "implementationCommits"
		, "milestone", "predecessorCommit", "schemaVersion", "scope"
		, "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "signature-specialization-completion-promotion-source-v1");
	assert.equal(record.predecessorCommit
		, signatureSpecializationCompletionPromotionPredecessor);
	assert.equal(record.implementationCommit
		, signatureSpecializationCompletionPromotionImplementation);
	assert.deepEqual(record.implementationCommits
		, signatureSpecializationCompletionPromotionCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${signatureSpecializationCompletionPromotionPredecessor}..${signatureSpecializationCompletionPromotionImplementation}`])
		.trim().split("\n"), signatureSpecializationCompletionPromotionCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationCompletionPromotionChangedPaths);
});

test("signature completion promotion reverses every exact source", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		if(update.path === "docs/type-surface.v1.json")
		{
			assert.equal(await authenticateSourceHistoryReverse(
				gitSourceBytes(
					signatureSpecializationCompletionPromotionImplementation
					, update.path), update), true);
			continue;
		}
		const previous = git(["show"
			, `${signatureSpecializationCompletionPromotionPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${signatureSpecializationCompletionPromotionImplementation}:${update.path}`]);
		assert.equal(reverseSignatureSpecializationCompletionPromotionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeSignatureSpecializationCompletionPromotionSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("signature completion promotion additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationCompletionPromotionAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("signature completion promotion rejects altered transitions", async () => {
	const update = (await readRecord()).updates.find(item =>
		item.path !== "docs/type-surface.v1.json");
	const current = git(["show"
		, `${signatureSpecializationCompletionPromotionImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseSignatureSpecializationCompletionPromotionUpdate(current, forged));
});

test("signature completion promotion writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-signature-completion-promotion-history-"));
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
		"scripts/update-signature-specialization-completion-promotion-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
