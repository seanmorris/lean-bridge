/**
 * Authenticate the generic Subtype WIT helper warning scope history layer.
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
	beforeGenericSubtypeWitHelperWarningScopeSource
	, genericSubtypeWitHelperWarningScopeAddedPaths
	, genericSubtypeWitHelperWarningScopeApplied
	, genericSubtypeWitHelperWarningScopeHistoryPath
	, genericSubtypeWitHelperWarningScopeImplementation
	, genericSubtypeWitHelperWarningScopeIntegrationBase
	, genericSubtypeWitHelperWarningScopeIntegrationPaths
	, genericSubtypeWitHelperWarningScopeModifiedPaths
	, genericSubtypeWitHelperWarningScopePredecessor
	, reverseGenericSubtypeWitHelperWarningScopeUpdate
} from "./generic-subtype-wit-helper-warning-scope-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	genericSubtypeWitHelperWarningScopeHistoryPath, "utf8"));
// This layer always reverses a recognized transition, so milestones resolve
// through the central hub alone, which owns every stop decision.
const atMilestone = (path, digest) => sourceAtFinHistoryMilestone(path, digest);
void inventoryPath;

test("generic Subtype WIT helper warning scope history restores every source"
	, async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "generic-subtype-wit-helper-warning-scope-source-v1");
	assert.equal(record.predecessorCommit, genericSubtypeWitHelperWarningScopePredecessor);
	assert.equal(record.implementationCommit, genericSubtypeWitHelperWarningScopeImplementation);
	assert.equal(record.integrationBaseCommit
		, genericSubtypeWitHelperWarningScopeIntegrationBase);
	assert.equal(record.appliedCommit, genericSubtypeWitHelperWarningScopeApplied);
	assert.deepEqual(record.updates.map(item => item.path)
		, genericSubtypeWitHelperWarningScopeModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, genericSubtypeWitHelperWarningScopeIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, genericSubtypeWitHelperWarningScopeAddedPaths);
	for(const update of record.updates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${genericSubtypeWitHelperWarningScopePredecessor}:${update.path}`]);
		assert.equal(current, git(["show"
			, `${genericSubtypeWitHelperWarningScopeImplementation}:${update.path}`]), update.path);
		assert.equal(reverseGenericSubtypeWitHelperWarningScopeUpdate(current, update), previous
			, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${genericSubtypeWitHelperWarningScopeIntegrationBase}:${update.path}`]);
		assert.equal(reverseGenericSubtypeWitHelperWarningScopeUpdate(current, update), previous
			, update.path);
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

test("generic Subtype WIT helper warning scope history is one exact commit", () => {
	const predecessor = genericSubtypeWitHelperWarningScopePredecessor;
	const implementation = genericSubtypeWitHelperWarningScopeImplementation;
	const modified = [...genericSubtypeWitHelperWarningScopeModifiedPaths].sort();
	assert.equal(git(["rev-parse", `${implementation}^`]).trim()
		, predecessor);
	assert.deepEqual(names(["diff", "--name-only", predecessor
		, implementation]), modified);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, predecessor, implementation]), modified);
});

test("generic Subtype WIT helper warning scope layer lets the hub reach older milestones"
	, async () => {
	const record = await readRecord();
	const update = [...record.updates, ...record.integrationUpdates].find(item =>
		item.path === "tests/generic-subtype-managed-wit.test.mjs");
	const current = await atMilestone(update.path, update.currentSha256);
	const older = "71076147b95eb9e2f1a613c4f04a8bf2fd7694d5";
	const target = git(["show", `${older}:${update.path}`]);
	assert.notEqual(sha256(target), update.previousSha256);
	assert.equal(beforeFinRefinementSource(update.path, current, sha256(target))
		, target);
	}
);

test("generic Subtype WIT helper warning scope history rejects alteration", async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await atMilestone(update.path, update.currentSha256);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseGenericSubtypeWitHelperWarningScopeUpdate(current, forged));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseGenericSubtypeWitHelperWarningScopeUpdate(current, shifted));
	const rewritten = structuredClone(update);
	rewritten.edits[0].previous += "x";
	assert.throws(() => reverseGenericSubtypeWitHelperWarningScopeUpdate(current, rewritten));
	assert.equal(beforeGenericSubtypeWitHelperWarningScopeSource(update.path, current, update.currentSha256)
		, reverseGenericSubtypeWitHelperWarningScopeUpdate(current, update)
		, "a recognized transition is reversed regardless of the stop digest");
	assert.equal(beforeGenericSubtypeWitHelperWarningScopeSource(update.path, `${current}unrelated\n`)
		, `${current}unrelated\n`);
	assert.equal(beforeGenericSubtypeWitHelperWarningScopeSource("docs/unrelated.md", current), current);
});

test("generic Subtype WIT helper warning scope history writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-generic-subtype-wit-helper-warning-scope-history-"));
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
		"scripts/update-generic-subtype-wit-helper-warning-scope-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /applied integration commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
