/**
 * Authenticate the generic-Subtype hosted-archive foundation history.
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
	beforeGenericSubtypeHostedArchiveSource
	, genericSubtypeHostedArchiveAddedPaths
	, genericSubtypeHostedArchiveCommits
	, genericSubtypeHostedArchiveHistoryPath
	, genericSubtypeHostedArchiveImplementation
	, genericSubtypeHostedArchiveImplementationAddedPaths
	, genericSubtypeHostedArchiveImplementationPaths
	, genericSubtypeHostedArchiveIntegrationPaths
	, genericSubtypeHostedArchiveModifiedPaths
	, genericSubtypeHostedArchivePredecessor
	, reverseGenericSubtypeHostedArchiveUpdate
} from "./generic-subtype-hosted-archive-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

test("generic Subtype hosted-archive history restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			genericSubtypeHostedArchiveHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "generic-subtype-hosted-archive-source-v1");
		assert.equal(record.predecessorCommit
			, genericSubtypeHostedArchivePredecessor);
		assert.equal(record.implementationCommit
			, genericSubtypeHostedArchiveImplementation);
		assert.deepEqual(record.implementationCommits
			, genericSubtypeHostedArchiveCommits);
		assert.deepEqual(record.updates.map(item => item.path)
			, genericSubtypeHostedArchiveModifiedPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, genericSubtypeHostedArchiveIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, genericSubtypeHostedArchiveAddedPaths);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${genericSubtypeHostedArchivePredecessor}:${update.path}`]);
			assert.equal(reverseGenericSubtypeHostedArchiveUpdate(
				current, update), previous, update.path);
			assert.equal(beforeGenericSubtypeHostedArchiveSource(
				update.path, current, update.currentSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path)
				, update.path);
		}
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${genericSubtypeHostedArchiveImplementation}:${update.path}`]);
			assert.equal(reverseGenericSubtypeHostedArchiveUpdate(
				current, update), previous, update.path);
			assert.equal(beforeGenericSubtypeHostedArchiveSource(
				update.path, current, update.currentSha256), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path)
				, update.path);
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("generic Subtype hosted-archive history range is exact", () => {
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${genericSubtypeHostedArchivePredecessor}..${genericSubtypeHostedArchiveImplementation}`])
		.trim().split("\n"), genericSubtypeHostedArchiveCommits);
	assert.deepEqual(names(["diff", "--name-only"
		, genericSubtypeHostedArchivePredecessor
		, genericSubtypeHostedArchiveImplementation])
	, [...genericSubtypeHostedArchiveImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, genericSubtypeHostedArchivePredecessor
		, genericSubtypeHostedArchiveImplementation])
	, [...genericSubtypeHostedArchiveModifiedPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
		, genericSubtypeHostedArchivePredecessor
		, genericSubtypeHostedArchiveImplementation])
	, [...genericSubtypeHostedArchiveImplementationAddedPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT"
		, genericSubtypeHostedArchivePredecessor
		, genericSubtypeHostedArchiveImplementation]), []);
});

test("generic Subtype hosted-archive history rejects alterations"
	, async () => {
		const record = JSON.parse(await readFile(
			genericSubtypeHostedArchiveHistoryPath, "utf8"));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		assert.throws(() => reverseGenericSubtypeHostedArchiveUpdate(
			current, { ...update, currentSha256: "0".repeat(64) }));
		assert.throws(() => reverseGenericSubtypeHostedArchiveUpdate(
			current, { ...update, path: "unknown.mjs" }));
		assert.equal(beforeGenericSubtypeHostedArchiveSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
);

test("generic Subtype hosted-archive writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-generic-subtype-hosted-archive-history-"));
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
			"scripts/update-generic-subtype-hosted-archive-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
