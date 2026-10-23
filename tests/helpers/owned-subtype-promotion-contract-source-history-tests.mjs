/**
 * Authenticate the owned-Subtype promotion-contract foundation.
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
	beforeOwnedSubtypePromotionContractSource
	, ownedSubtypePromotionContractAddedPaths
	, ownedSubtypePromotionContractHistoryPath
	, ownedSubtypePromotionContractImplementation
	, ownedSubtypePromotionContractImplementationAdditions
	, ownedSubtypePromotionContractImplementationPaths
	, ownedSubtypePromotionContractIntegrationPaths
	, ownedSubtypePromotionContractModifiedPaths
	, ownedSubtypePromotionContractPredecessor
	, reverseOwnedSubtypePromotionContractUpdate
} from "./owned-subtype-promotion-contract-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned Subtype promotion-contract history restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedSubtypePromotionContractHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "owned-subtype-promotion-contract-v1");
		assert.equal(record.predecessorCommit
			, ownedSubtypePromotionContractPredecessor);
		assert.equal(record.implementationCommit
			, ownedSubtypePromotionContractImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, ownedSubtypePromotionContractModifiedPaths);
		assert.deepEqual(record.implementationAdditions.map(item => item.path)
			, ownedSubtypePromotionContractImplementationAdditions);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, ownedSubtypePromotionContractIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, ownedSubtypePromotionContractAddedPaths);
		for(const update of [...record.updates, ...record.integrationUpdates])
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeOwnedSubtypePromotionContractSource);
			const base = record.updates.includes(update)
				? ownedSubtypePromotionContractPredecessor
				: ownedSubtypePromotionContractImplementation;
			const previous = git(["show", `${base}:${update.path}`]);
			assert.equal(reverseOwnedSubtypePromotionContractUpdate(
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
	}
);

test("owned Subtype promotion-contract history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypePromotionContractImplementation}^`]).trim()
	, ownedSubtypePromotionContractPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypePromotionContractPredecessor
		, ownedSubtypePromotionContractImplementation]).trim()
		.split("\n").sort()
	, [...ownedSubtypePromotionContractImplementationPaths].sort());
});

test("owned Subtype promotion-contract history rejects alterations"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedSubtypePromotionContractHistoryPath, "utf8"));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedSubtypePromotionContractSource);
		assert.throws(() => reverseOwnedSubtypePromotionContractUpdate(
			current, { ...update, currentSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedSubtypePromotionContractUpdate(
			current, { ...update, path: "unknown.mjs" }));
		assert.equal(beforeOwnedSubtypePromotionContractSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
);

test("owned Subtype promotion-contract writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(tmpdir()
			, "lean-owned-subtype-promotion-contract-guard-"));
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
			"scripts/update-owned-subtype-promotion-contract-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
