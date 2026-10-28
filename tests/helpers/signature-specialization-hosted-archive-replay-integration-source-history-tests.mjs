/**
 * Authenticate the central hosted-signature archive replay integration.
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
	beforeSignatureSpecializationHostedArchiveReplayIntegrationSource
	, reverseSignatureSpecializationHostedArchiveReplayIntegrationUpdate
	, signatureSpecializationHostedArchiveReplayIntegrationAddedPaths
	, signatureSpecializationHostedArchiveReplayIntegrationChangedPaths
	, signatureSpecializationHostedArchiveReplayIntegrationHistoryPath
	, signatureSpecializationHostedArchiveReplayIntegrationImplementation
	, signatureSpecializationHostedArchiveReplayIntegrationPredecessor
} from "./signature-specialization-hosted-archive-replay-integration-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationHostedArchiveReplayIntegrationHistoryPath, "utf8"
));

test("hosted signature archive replay integration restores its exact hub", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "implementationCommit", "milestone"
		, "predecessorCommit", "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "signature-specialization-hosted-archive-replay-integration-source-v1");
	assert.equal(record.predecessorCommit
		, signatureSpecializationHostedArchiveReplayIntegrationPredecessor);
	assert.equal(record.implementationCommit
		, signatureSpecializationHostedArchiveReplayIntegrationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationHostedArchiveReplayIntegrationChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${signatureSpecializationHostedArchiveReplayIntegrationPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${signatureSpecializationHostedArchiveReplayIntegrationImplementation}:${update.path}`]);
		assert.equal(
			reverseSignatureSpecializationHostedArchiveReplayIntegrationUpdate(
				current, update), previous, update.path);
		assert.equal(
			beforeSignatureSpecializationHostedArchiveReplayIntegrationSource(
				update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationHostedArchiveReplayIntegrationAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("hosted signature archive replay integration rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${signatureSpecializationHostedArchiveReplayIntegrationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseSignatureSpecializationHostedArchiveReplayIntegrationUpdate(
			current, forged));
});

test("hosted signature archive replay integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-signature-archive-replay-integration-history-"));
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
		"scripts/update-signature-specialization-hosted-archive-replay-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
