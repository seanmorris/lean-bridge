/**
 * Authenticate the hosted-signature completion preparation milestone.
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
	beforeSignatureSpecializationCompletionPreparationSource
	, reverseSignatureSpecializationCompletionPreparationUpdate
	, signatureSpecializationCompletionPreparationAddedPaths
	, signatureSpecializationCompletionPreparationChangedPaths
	, signatureSpecializationCompletionPreparationHistoryPath
	, signatureSpecializationCompletionPreparationImplementation
	, signatureSpecializationCompletionPreparationImplementationAdditions
	, signatureSpecializationCompletionPreparationPredecessor
} from "./signature-specialization-completion-preparation-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationCompletionPreparationHistoryPath, "utf8"
));

test("signature completion preparation records its exact implementation", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "implementationAdditions", "implementationCommit"
		, "milestone", "predecessorCommit", "schemaVersion", "scope"
		, "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "signature-specialization-completion-preparation-source-v1");
	assert.equal(record.predecessorCommit
		, signatureSpecializationCompletionPreparationPredecessor);
	assert.equal(record.implementationCommit
		, signatureSpecializationCompletionPreparationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationCompletionPreparationChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${signatureSpecializationCompletionPreparationPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${signatureSpecializationCompletionPreparationImplementation}:${update.path}`]);
		assert.equal(reverseSignatureSpecializationCompletionPreparationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeSignatureSpecializationCompletionPreparationSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("signature completion preparation additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.implementationAdditions.map(item => item.path)
		, signatureSpecializationCompletionPreparationImplementationAdditions);
	for(const addition of record.implementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, signatureSpecializationCompletionPreparationPredecessor
			, "--", addition.path]).trim(), "");
		assert.equal(sha256(git(["show"
			, `${signatureSpecializationCompletionPreparationImplementation}:${addition.path}`]))
		, addition.currentSha256, addition.path);
	}
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationCompletionPreparationAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("signature completion preparation rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${signatureSpecializationCompletionPreparationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseSignatureSpecializationCompletionPreparationUpdate(
			current, forged));
	const unknown = `${current}unknown\n`;
	assert.equal(beforeSignatureSpecializationCompletionPreparationSource(
		update.path, unknown), unknown);
});

test("signature completion preparation writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-signature-completion-preparation-history-"));
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
		"scripts/update-signature-specialization-completion-preparation-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
