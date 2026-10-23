/**
 * Authenticate the WIT recursive reader traversal repair history layer.
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
	beforeWitRecursiveReaderTraversalRepairSource
	, witRecursiveReaderTraversalRepairAddedPaths
	, witRecursiveReaderTraversalRepairHistoryPath
	, witRecursiveReaderTraversalRepairApplied
	, witRecursiveReaderTraversalRepairImplementation
	, witRecursiveReaderTraversalRepairIntegrationBase
	, witRecursiveReaderTraversalRepairIntegrationPaths
	, witRecursiveReaderTraversalRepairModifiedPaths
	, witRecursiveReaderTraversalRepairPredecessor
	, reverseWitRecursiveReaderTraversalRepairUpdate
} from "./wit-recursive-reader-traversal-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeWitRecursiveCallables
} from "./wit-recursive-callable-source-history.mjs";
import { beforeOwnedAggregates } from "./owned-aggregate-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	witRecursiveReaderTraversalRepairHistoryPath, "utf8"));
// This layer always reverses a recognized transition, so milestones resolve
// through the central hub alone, which owns every stop decision.
const atMilestone = (path, digest) => sourceAtFinHistoryMilestone(path, digest);
void inventoryPath;

test("WIT recursive reader traversal repair history restores every source"
	, async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "wit-recursive-reader-traversal-repair-source-v1");
	assert.equal(record.predecessorCommit, witRecursiveReaderTraversalRepairPredecessor);
	assert.equal(record.implementationCommit, witRecursiveReaderTraversalRepairImplementation);
	assert.equal(record.integrationBaseCommit, git(["rev-parse"
		, witRecursiveReaderTraversalRepairIntegrationBase]).trim());
	assert.equal(record.appliedCommit, git(["rev-parse"
		, witRecursiveReaderTraversalRepairApplied]).trim());
	assert.deepEqual(record.updates.map(item => item.path)
		, witRecursiveReaderTraversalRepairModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, witRecursiveReaderTraversalRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, witRecursiveReaderTraversalRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${witRecursiveReaderTraversalRepairPredecessor}:${update.path}`]);
		assert.equal(current, git(["show"
			, `${witRecursiveReaderTraversalRepairImplementation}:${update.path}`]), update.path);
		assert.equal(reverseWitRecursiveReaderTraversalRepairUpdate(current, update), previous
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
			, `${witRecursiveReaderTraversalRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseWitRecursiveReaderTraversalRepairUpdate(current, update), previous
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

test("WIT recursive reader traversal repair history is one exact commit", () => {
	const predecessor = witRecursiveReaderTraversalRepairPredecessor;
	const implementation = witRecursiveReaderTraversalRepairImplementation;
	const modified = [...witRecursiveReaderTraversalRepairModifiedPaths].sort();
	assert.equal(git(["rev-parse", `${implementation}^`]).trim()
		, predecessor);
	assert.deepEqual(names(["diff", "--name-only", predecessor
		, implementation]), modified);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, predecessor, implementation]), modified);
});

test("WIT recursive reader traversal repair history refreshes exactly the closed live pins"
	, async () => {
	const record = await readRecord();
	const inventoryUpdate = record.integrationUpdates.find(item =>
		item.path === inventoryPath);
	// Read this layer's own inventory milestone, never the live inventory that
	// later pin layers keep changing.
	const inventory = JSON.parse(await atMilestone(
		inventoryPath, inventoryUpdate.currentSha256));
	const before = JSON.parse(git(["show"
		, `${witRecursiveReaderTraversalRepairIntegrationBase}:${inventoryPath}`]));
	const expected = new Map([
		...record.updates.map(item => [item.path, item.currentSha256])
		, ...record.integrationUpdates.filter(item => item.path !== inventoryPath)
			.map(item => [item.path, item.currentSha256])
	]);
	assert.equal(inventory.evidence.length, before.evidence.length);
	let refreshed = 0;
	for(const [index, evidence] of inventory.evidence.entries())
	{
		const previous = before.evidence[index];
		assert.equal(evidence.files.length, previous.files.length);
		for(const [position, file] of evidence.files.entries())
		{
			const old = previous.files[position];
			assert.equal(file.path, old.path);
			if(expected.has(file.path))
			{
				assert.ok(!file.path.startsWith("docs/evidence/"), file.path);
				assert.equal(file.sha256, expected.get(file.path), file.path);
				if(old.sha256 !== file.sha256) refreshed++;
			}
			else assert.equal(file.sha256, old.sha256, file.path);
		}
	}
	assert.ok(refreshed > 0);
	assert.equal(beforeFinRefinementSource(inventoryPath
		, JSON.stringify(inventory, null, 2) + "\n"
		, inventoryUpdate.previousSha256)
	, git(["show", `${witRecursiveReaderTraversalRepairIntegrationBase}:${inventoryPath}`]));
	}
);

test("WIT recursive reader traversal repair layer lets the hub reach older milestones"
	, async () => {
	const record = await readRecord();
	const update = [...record.updates, ...record.integrationUpdates].find(item =>
		item.path === "tests/helpers/wit-recursive-callable-source-history.mjs");
	const current = await atMilestone(update.path, update.currentSha256);
	const older = "7f0583c5d17f806d22ae5d758509cf2757ddf2a3";
	const target = git(["show", `${older}:${update.path}`]);
	assert.notEqual(sha256(target), update.previousSha256);
	assert.equal(beforeFinRefinementSource(update.path, current, sha256(target))
		, target);
	}
);

test("WIT recursive reader traversal repair history rejects alteration", async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await atMilestone(update.path, update.currentSha256);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseWitRecursiveReaderTraversalRepairUpdate(current, forged));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseWitRecursiveReaderTraversalRepairUpdate(current, shifted));
	const rewritten = structuredClone(update);
	rewritten.edits[0].previous += "x";
	assert.throws(() => reverseWitRecursiveReaderTraversalRepairUpdate(current, rewritten));
	assert.equal(beforeWitRecursiveReaderTraversalRepairSource(update.path, current, update.currentSha256)
		, reverseWitRecursiveReaderTraversalRepairUpdate(current, update)
		, "a recognized transition is reversed regardless of the stop digest");
	assert.equal(beforeWitRecursiveReaderTraversalRepairSource(update.path, `${current}unrelated\n`)
		, `${current}unrelated\n`);
	assert.equal(beforeWitRecursiveReaderTraversalRepairSource("docs/unrelated.md", current), current);
});

test("WIT recursive reader traversal repair history writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-wit-recursive-reader-traversal-repair-history-"));
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
		"scripts/update-wit-recursive-reader-traversal-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /applied integration commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);

test("WIT recursive reader crosses later layers before its own transition"
	, async () => {
	const path = ".github/workflows/consumer-matrix.yml";
	const live = await readFile(path, "utf8");
	// 262240d recorded 025861ef -> 9b102dca; later owned layers moved on.
	const milestone
		= "9b102dca910d6f8f31cf49dc1c3ee23bf9f9c8549e30f3aa710d7eb9606252b4";
	const predecessor
		= "025861efbeea2dfb38f0c91a7e034ddd948e87c279f648e9c166e2ceea11ddab";
	assert.notEqual(sha256(live), milestone);
	assert.equal(sha256(beforeWitRecursiveCallables(path, live, milestone))
		, milestone);
	assert.equal(sha256(beforeWitRecursiveCallables(path, live, predecessor))
		, predecessor);
	assert.equal(beforeWitRecursiveCallables(path, live)
		, git(["show", `7daacb8:${path}`]));
	// The exact-milestone branch still reverses this transition first.
	const exact = beforeOwnedAggregates(path, live, milestone);
	assert.equal(sha256(exact), milestone);
	assert.equal(sha256(beforeWitRecursiveCallables(path, exact)), predecessor);
	// Paths outside this record still traverse every later transition.
	const unrelated = ".github/workflows/perl-consumer.yml";
	const source = await readFile(unrelated, "utf8");
	assert.equal(beforeWitRecursiveCallables(unrelated, source)
		, beforeOwnedAggregates(unrelated, source));
	}
);
