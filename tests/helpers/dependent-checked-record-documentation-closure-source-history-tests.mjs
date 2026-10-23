/**
 * Authenticate the dependent checked-record documentation closure.
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
	beforeDependentCheckedRecordDocumentationClosureSource
	, dependentCheckedRecordDocumentationClosureAddedPaths
	, dependentCheckedRecordDocumentationClosureHistoryPath
	, dependentCheckedRecordDocumentationClosureImplementation
	, dependentCheckedRecordDocumentationClosureImplementationPaths
	, dependentCheckedRecordDocumentationClosureIntegrationPaths
	, dependentCheckedRecordDocumentationClosureModifiedPaths
	, dependentCheckedRecordDocumentationClosurePredecessor
	, reverseDependentCheckedRecordDocumentationClosureUpdate
} from "./dependent-checked-record-documentation-closure-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

test("dependent checked-record documentation closure restores every source"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordDocumentationClosureHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-documentation-closure-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordDocumentationClosurePredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordDocumentationClosureImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordDocumentationClosureModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordDocumentationClosureIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, dependentCheckedRecordDocumentationClosureAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordDocumentationClosureSource);
		const previous = git(["show"
			, `${dependentCheckedRecordDocumentationClosurePredecessor}:${update.path}`]);
		assert.equal(reverseDependentCheckedRecordDocumentationClosureUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordDocumentationClosureSource);
		const previous = git(["show"
			, `${dependentCheckedRecordDocumentationClosureImplementation}:${update.path}`]);
		assert.equal(reverseDependentCheckedRecordDocumentationClosureUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	const inventoryUpdate = record.integrationUpdates.find(item => item.path
		=== "docs/type-surface.v1.json");
	const inventory = await sourceAtFinHistoryMilestone(
		inventoryUpdate.path, inventoryUpdate.currentSha256
		, beforeDependentCheckedRecordDocumentationClosureSource);
	assert.equal(beforeDependentCheckedRecordDocumentationClosureSource(
		inventoryUpdate.path, inventory
		, record.updates.find(item => item.path
			=== inventoryUpdate.path).previousSha256)
	, git(["show"
		, `${dependentCheckedRecordDocumentationClosurePredecessor}:${inventoryUpdate.path}`]));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("dependent checked-record documentation closure is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${dependentCheckedRecordDocumentationClosureImplementation}^`]).trim()
	, dependentCheckedRecordDocumentationClosurePredecessor);
	assert.deepEqual(names(["diff", "--name-only"
		, dependentCheckedRecordDocumentationClosurePredecessor
		, dependentCheckedRecordDocumentationClosureImplementation])
	, [...dependentCheckedRecordDocumentationClosureImplementationPaths].sort());
});

test("dependent checked-record documentation closure rejects alteration"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordDocumentationClosureHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordDocumentationClosureSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseDependentCheckedRecordDocumentationClosureUpdate(
			current, update));
	}
);

test("dependent checked-record documentation writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-record-doc-closure-history-"));
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
		"scripts/update-dependent-checked-record-documentation-closure-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);}
);
