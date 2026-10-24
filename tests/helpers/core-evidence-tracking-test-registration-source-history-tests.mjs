/**
 * Authenticate the Core evidence-tracking test registration repair.
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
	beforeCoreEvidenceTrackingTestRegistrationSource
	, coreEvidenceTrackingTestRegistrationAddedPaths
	, coreEvidenceTrackingTestRegistrationChangedPaths
	, coreEvidenceTrackingTestRegistrationHistoryPath
	, coreEvidenceTrackingTestRegistrationImplementation
	, coreEvidenceTrackingTestRegistrationIntegrationPaths
	, coreEvidenceTrackingTestRegistrationPredecessor
	, reverseCoreEvidenceTrackingTestRegistrationUpdate
} from "./core-evidence-tracking-test-registration-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Core evidence-tracking registration history restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			coreEvidenceTrackingTestRegistrationHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "core-evidence-tracking-test-registration-source-v1");
		assert.equal(record.predecessorCommit
			, coreEvidenceTrackingTestRegistrationPredecessor);
		assert.equal(record.implementationCommit
			, coreEvidenceTrackingTestRegistrationImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, coreEvidenceTrackingTestRegistrationChangedPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, coreEvidenceTrackingTestRegistrationIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, coreEvidenceTrackingTestRegistrationAddedPaths);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeCoreEvidenceTrackingTestRegistrationSource);
			const previous = git(["show"
				, `${coreEvidenceTrackingTestRegistrationPredecessor}:${update.path}`]);
			assert.equal(reverseCoreEvidenceTrackingTestRegistrationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256)
			, previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeCoreEvidenceTrackingTestRegistrationSource);
			const previous = git(["show"
				, `${coreEvidenceTrackingTestRegistrationImplementation}:${update.path}`]);
			assert.equal(reverseCoreEvidenceTrackingTestRegistrationUpdate(
				current, update), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("Core evidence-tracking registration is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${coreEvidenceTrackingTestRegistrationImplementation}^`]).trim()
	, coreEvidenceTrackingTestRegistrationPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreEvidenceTrackingTestRegistrationPredecessor
		, coreEvidenceTrackingTestRegistrationImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...coreEvidenceTrackingTestRegistrationChangedPaths].sort());
});

test("Core evidence-tracking registration history rejects alteration"
	, async () => {
		const record = JSON.parse(await readFile(
			coreEvidenceTrackingTestRegistrationHistoryPath, "utf8"));
		const original = record.updates[0];
		const current = await sourceAtFinHistoryMilestone(original.path
			, original.currentSha256
			, beforeCoreEvidenceTrackingTestRegistrationSource);
		const update = structuredClone(original);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseCoreEvidenceTrackingTestRegistrationUpdate(
			current, update));
	}
);

test("Core evidence-tracking registration writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-core-evidence-registration-history-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const environment = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const run = arguments_ => execFileSync("git", arguments_
			, { cwd: root, env: environment, stdio: "pipe" });
		run(["init", "--quiet"]);
		run(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
			, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-core-evidence-tracking-test-registration-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /exact implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
