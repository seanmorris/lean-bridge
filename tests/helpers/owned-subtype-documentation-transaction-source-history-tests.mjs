/**
 * Authenticate the owned-Subtype documentation transaction.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedSubtypeDocumentationTransactionSource
	, ownedSubtypeConsumerDocumentationGateImplementation
	, ownedSubtypeConsumerDocumentationGatePaths
	, ownedSubtypeConsumerDocumentationGatePredecessor
	, ownedSubtypeDocumentationTransactionAddedPaths
	, ownedSubtypeDocumentationTransactionHistoryPath
	, ownedSubtypeDocumentationTransactionImplementation
	, ownedSubtypeDocumentationTransactionImplementationAdditions
	, ownedSubtypeDocumentationTransactionImplementationPaths
	, ownedSubtypeDocumentationTransactionIntegrationPaths
	, ownedSubtypeDocumentationTransactionModifiedPaths
	, ownedSubtypeDocumentationTransactionPredecessor
	, reverseOwnedSubtypeDocumentationTransactionUpdate
} from "./owned-subtype-documentation-transaction-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned Subtype documentation history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeDocumentationTransactionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-subtype-documentation-transaction-v1");
	assert.equal(record.gatePredecessorCommit
		, ownedSubtypeConsumerDocumentationGatePredecessor);
	assert.equal(record.gateCommit
		, ownedSubtypeConsumerDocumentationGateImplementation);
	assert.equal(record.predecessorCommit
		, ownedSubtypeDocumentationTransactionPredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypeDocumentationTransactionImplementation);
	assert.equal(record.integrationBaseCommit
		, "c18899436eb5c9c9e874a4b762a9af5d744cb11c");
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeDocumentationTransactionModifiedPaths);
	assert.deepEqual(record.gateUpdates.map(item => item.path)
		, ownedSubtypeConsumerDocumentationGatePaths);
	assert.deepEqual(record.implementationAdditions.map(item => item.path)
		, ownedSubtypeDocumentationTransactionImplementationAdditions);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeDocumentationTransactionIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeDocumentationTransactionAddedPaths);
	for(const update of [
		...record.gateUpdates, ...record.updates, ...record.integrationUpdates
	]){
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedSubtypeDocumentationTransactionSource);
		const base = record.gateUpdates.includes(update)
			? ownedSubtypeConsumerDocumentationGatePredecessor
			: record.updates.includes(update)
				? ownedSubtypeDocumentationTransactionPredecessor
				: record.integrationBaseCommit;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeDocumentationTransactionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of [
		...record.implementationAdditions, ...record.additions
	]) assert.equal(sha256(await sourceAtFinHistoryMilestone(
		addition.path, addition.currentSha256))
	, addition.currentSha256, addition.path);
});

test("owned Subtype documentation history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypeConsumerDocumentationGateImplementation}^`]).trim()
	, ownedSubtypeConsumerDocumentationGatePredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeConsumerDocumentationGatePredecessor
		, ownedSubtypeConsumerDocumentationGateImplementation]).trim()
		.split("\n").sort()
	, [...ownedSubtypeConsumerDocumentationGatePaths].sort());
	assert.equal(git(["rev-parse"
		, `${ownedSubtypeDocumentationTransactionImplementation}^`]).trim()
	, ownedSubtypeDocumentationTransactionPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeDocumentationTransactionPredecessor
		, ownedSubtypeDocumentationTransactionImplementation]).trim()
		.split("\n").sort()
	, [...ownedSubtypeDocumentationTransactionImplementationPaths].sort());
});

test("owned Subtype documentation history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeDocumentationTransactionHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeOwnedSubtypeDocumentationTransactionSource);
	assert.throws(() => reverseOwnedSubtypeDocumentationTransactionUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseOwnedSubtypeDocumentationTransactionUpdate(
		current, { ...update, path: "unknown.mjs" }));
	assert.equal(beforeOwnedSubtypeDocumentationTransactionSource(
		update.path, `${current}unknown`), `${current}unknown`);
});

test("owned Subtype documentation writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-owned-subtype-documentation-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-subtype-documentation-transaction-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /integration commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
