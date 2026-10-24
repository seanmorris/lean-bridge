/**
 * Authenticate the generic Subtype managed TAP escape repair.
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
	beforeGenericSubtypeManagedTapEscapeRepairSource
	, genericSubtypeManagedTapEscapeRepairAddedPaths
	, genericSubtypeManagedTapEscapeRepairChangedPaths
	, genericSubtypeManagedTapEscapeRepairHistoryPath
	, genericSubtypeManagedTapEscapeRepairImplementation
	, genericSubtypeManagedTapEscapeRepairIntegrationPaths
	, genericSubtypeManagedTapEscapeRepairPredecessor
	, reverseGenericSubtypeManagedTapEscapeRepairUpdate
} from "./generic-subtype-managed-tap-escape-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("generic Subtype managed TAP escape history restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			genericSubtypeManagedTapEscapeRepairHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "generic-subtype-managed-tap-escape-repair-source-v1");
		assert.equal(record.predecessorCommit
			, genericSubtypeManagedTapEscapeRepairPredecessor);
		assert.equal(record.implementationCommit
			, genericSubtypeManagedTapEscapeRepairImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, genericSubtypeManagedTapEscapeRepairChangedPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, genericSubtypeManagedTapEscapeRepairIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, genericSubtypeManagedTapEscapeRepairAddedPaths);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeGenericSubtypeManagedTapEscapeRepairSource);
			const previous = git(["show"
				, `${genericSubtypeManagedTapEscapeRepairPredecessor}:${update.path}`]);
			assert.equal(reverseGenericSubtypeManagedTapEscapeRepairUpdate(
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
				, beforeGenericSubtypeManagedTapEscapeRepairSource);
			const previous = git(["show"
				, `${genericSubtypeManagedTapEscapeRepairImplementation}:${update.path}`]);
			assert.equal(reverseGenericSubtypeManagedTapEscapeRepairUpdate(
				current, update), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("generic Subtype managed TAP escape repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${genericSubtypeManagedTapEscapeRepairImplementation}^`]).trim()
	, genericSubtypeManagedTapEscapeRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, genericSubtypeManagedTapEscapeRepairPredecessor
		, genericSubtypeManagedTapEscapeRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...genericSubtypeManagedTapEscapeRepairChangedPaths].sort());
});

test("generic Subtype managed TAP escape history rejects alteration"
	, async () => {
		const record = JSON.parse(await readFile(
			genericSubtypeManagedTapEscapeRepairHistoryPath, "utf8"));
		for(const original of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(original.path
				, original.currentSha256
				, beforeGenericSubtypeManagedTapEscapeRepairSource);
			const update = structuredClone(original);
			update.currentSha256 = "0".repeat(64);
			assert.throws(() => reverseGenericSubtypeManagedTapEscapeRepairUpdate(
				current, update), original.path);
		}
	}
);

test("generic Subtype managed TAP escape writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-generic-subtype-managed-tap-history-"));
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
			"scripts/update-generic-subtype-managed-tap-escape-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /exact implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
