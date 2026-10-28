/**
 * Authenticate central integration of the installed-signature completion.
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
	beforeSignatureSpecializationCompletionIntegrationSource
	, reverseSignatureSpecializationCompletionIntegrationUpdate
	, signatureSpecializationCompletionIntegrationAddedPaths
	, signatureSpecializationCompletionIntegrationBase
	, signatureSpecializationCompletionIntegrationHistoryPath
	, signatureSpecializationCompletionIntegrationImplementation
	, signatureSpecializationCompletionIntegrationPaths
} from "./signature-specialization-completion-integration-source-history.mjs";
import {
	signatureSpecializationCompletionHistoryPath
} from "./signature-specialization-completion-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationCompletionIntegrationHistoryPath, "utf8"
));

test("signature specialization integration restores its exact hub and partition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions", "baseCommit"
		, "baseHistory", "implementationCommit", "milestone"
		, "schemaVersion", "scope", "updates"].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "signature-specialization-completion-integration-v1");
	assert.equal(record.baseCommit
		, signatureSpecializationCompletionIntegrationBase);
	assert.equal(record.implementationCommit
		, signatureSpecializationCompletionIntegrationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationCompletionIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationCompletionIntegrationAddedPaths);
	assert.deepEqual(record.baseHistory, {
		path: signatureSpecializationCompletionHistoryPath
		, sha256: sha256(await readFile(
			signatureSpecializationCompletionHistoryPath))
	});
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeSignatureSpecializationCompletionIntegrationSource);
		const previous = git(["show"
			, `${signatureSpecializationCompletionIntegrationBase}:${update.path}`]);
		assert.equal(reverseSignatureSpecializationCompletionIntegrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.equal(beforeSignatureSpecializationCompletionIntegrationSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("signature specialization integration additions restore exactly", async () => {
	for(const addition of (await readRecord()).additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("signature specialization integration rejects alteration", async () => {
	const update = (await readRecord()).updates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeSignatureSpecializationCompletionIntegrationSource);
	assert.throws(() => reverseSignatureSpecializationCompletionIntegrationUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforeSignatureSpecializationCompletionIntegrationSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});

test("signature specialization integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-signature-specialization-integration-"));
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
		"scripts/update-signature-specialization-completion-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
