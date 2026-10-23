/**
 * Authenticate the generic-Subtype hosted artifact-prefix repair.
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
	beforeGenericSubtypeArtifactPrefixRepairSource
	, genericSubtypeArtifactPrefixRepairAddedPaths
	, genericSubtypeArtifactPrefixRepairHistoryPath
	, genericSubtypeArtifactPrefixRepairImplementation
	, genericSubtypeArtifactPrefixRepairImplementationPaths
	, genericSubtypeArtifactPrefixRepairIntegrationPaths
	, genericSubtypeArtifactPrefixRepairPredecessor
	, reverseGenericSubtypeArtifactPrefixRepairUpdate
} from "./generic-subtype-artifact-prefix-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

test("generic-Subtype artifact-prefix history restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			genericSubtypeArtifactPrefixRepairHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "generic-subtype-artifact-prefix-repair-v1");
		assert.equal(record.predecessorCommit
			, genericSubtypeArtifactPrefixRepairPredecessor);
		assert.equal(record.implementationCommit
			, genericSubtypeArtifactPrefixRepairImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, genericSubtypeArtifactPrefixRepairImplementationPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, genericSubtypeArtifactPrefixRepairIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, genericSubtypeArtifactPrefixRepairAddedPaths);
		for(const update of [...record.updates, ...record.integrationUpdates])
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeGenericSubtypeArtifactPrefixRepairSource);
			const base = record.updates.includes(update)
				? genericSubtypeArtifactPrefixRepairPredecessor
				: genericSubtypeArtifactPrefixRepairImplementation;
			const previous = git(["show", `${base}:${update.path}`]);
			assert.equal(reverseGenericSubtypeArtifactPrefixRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous
				, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path)
				, update.path);
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("generic-Subtype artifact-prefix history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${genericSubtypeArtifactPrefixRepairImplementation}^`]).trim()
	, genericSubtypeArtifactPrefixRepairPredecessor);
	assert.deepEqual(names(["diff", "--name-only"
		, genericSubtypeArtifactPrefixRepairPredecessor
		, genericSubtypeArtifactPrefixRepairImplementation])
	, [...genericSubtypeArtifactPrefixRepairImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, genericSubtypeArtifactPrefixRepairPredecessor
		, genericSubtypeArtifactPrefixRepairImplementation])
	, [...genericSubtypeArtifactPrefixRepairImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
		, genericSubtypeArtifactPrefixRepairPredecessor
		, genericSubtypeArtifactPrefixRepairImplementation]), []);
});

test("generic-Subtype artifact-prefix history rejects alterations"
	, async () => {
		const record = JSON.parse(await readFile(
			genericSubtypeArtifactPrefixRepairHistoryPath, "utf8"));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeGenericSubtypeArtifactPrefixRepairSource);
		assert.throws(() => reverseGenericSubtypeArtifactPrefixRepairUpdate(
			current, { ...update, currentSha256: "0".repeat(64) }));
		assert.throws(() => reverseGenericSubtypeArtifactPrefixRepairUpdate(
			current, { ...update, path: "unknown.mjs" }));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseGenericSubtypeArtifactPrefixRepairUpdate(
			current, shifted));
		assert.equal(beforeGenericSubtypeArtifactPrefixRepairSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
);

test("generic-Subtype artifact-prefix writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-generic-subtype-prefix-guard-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const environment = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const localGit = arguments_ => execFileSync("git", arguments_, {
			cwd: root, env: environment, stdio: "pipe"
		});
		localGit(["init", "--quiet"]);
		localGit(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c"
			, "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
			, "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-generic-subtype-artifact-prefix-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
