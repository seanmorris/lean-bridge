/**
 * Authenticate the owned-Subtype hosted-evidence test registration.
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
	beforeOwnedSubtypeEvidenceTestRegistrationSource
	, ownedSubtypeEvidenceTestRegistrationAddedPaths
	, ownedSubtypeEvidenceTestRegistrationHistoryPath
	, ownedSubtypeEvidenceTestRegistrationImplementation
	, ownedSubtypeEvidenceTestRegistrationImplementationPaths
	, ownedSubtypeEvidenceTestRegistrationIntegrationPaths
	, ownedSubtypeEvidenceTestRegistrationPredecessor
	, ownedSubtypeEvidenceTestRegistrationTests
	, reverseOwnedSubtypeEvidenceTestRegistrationUpdate
} from "./owned-subtype-evidence-test-registration-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned Subtype evidence-test registration restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedSubtypeEvidenceTestRegistrationHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "owned-subtype-evidence-test-registration-v1");
		assert.equal(record.predecessorCommit
			, ownedSubtypeEvidenceTestRegistrationPredecessor);
		assert.equal(record.implementationCommit
			, ownedSubtypeEvidenceTestRegistrationImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, ownedSubtypeEvidenceTestRegistrationImplementationPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, ownedSubtypeEvidenceTestRegistrationIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, ownedSubtypeEvidenceTestRegistrationAddedPaths);
		assert.deepEqual(record.updates.find(item =>
			item.path === "src/adoption/test-profiles.mjs").addedTests
		, ownedSubtypeEvidenceTestRegistrationTests);
		for(const update of [...record.updates, ...record.integrationUpdates])
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeOwnedSubtypeEvidenceTestRegistrationSource);
			const base = record.updates.includes(update)
				? ownedSubtypeEvidenceTestRegistrationPredecessor
				: ownedSubtypeEvidenceTestRegistrationImplementation;
			const previous = git(["show", `${base}:${update.path}`]);
			assert.equal(reverseOwnedSubtypeEvidenceTestRegistrationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path)
				, update.path);
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("owned Subtype evidence-test registration range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypeEvidenceTestRegistrationImplementation}^`]).trim()
	, ownedSubtypeEvidenceTestRegistrationPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeEvidenceTestRegistrationPredecessor
		, ownedSubtypeEvidenceTestRegistrationImplementation]).trim()
		.split("\n").sort()
	, [...ownedSubtypeEvidenceTestRegistrationImplementationPaths].sort());
});

test("owned Subtype evidence-test registration rejects alterations"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedSubtypeEvidenceTestRegistrationHistoryPath, "utf8"));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedSubtypeEvidenceTestRegistrationSource);
		assert.throws(() => reverseOwnedSubtypeEvidenceTestRegistrationUpdate(
			current, { ...update, currentSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedSubtypeEvidenceTestRegistrationUpdate(
			current, { ...update, path: "unknown.mjs" }));
		assert.equal(beforeOwnedSubtypeEvidenceTestRegistrationSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
);

test("owned Subtype evidence-test registration writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(tmpdir()
			, "lean-owned-subtype-evidence-registration-guard-"));
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
			"scripts/update-owned-subtype-evidence-test-registration-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
