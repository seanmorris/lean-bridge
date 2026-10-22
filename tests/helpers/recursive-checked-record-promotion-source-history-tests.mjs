/**
 * Preserve every predecessor through aggregate recursive-record promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforeRecursiveCheckedRecordPromotionSource
	, recursiveCheckedRecordPromotionAddedPaths
	, recursiveCheckedRecordPromotionChangedPaths
	, recursiveCheckedRecordPromotionDraftParent
	, recursiveCheckedRecordPromotionHistoryPath
	, recursiveCheckedRecordPromotionPredecessor
	, reverseRecursiveCheckedRecordPromotionUpdate
} from "./recursive-checked-record-promotion-source-history.mjs";
import {
	promoteRecursiveCheckedRecords, recursiveCheckedRecordReferences
} from "./recursive-checked-record-promotion.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
} from "./source-history-test-source.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});

test("recursive checked-record promotion has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		recursiveCheckedRecordPromotionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "recursive-checked-record-promotion-source-v1");
	assert.equal(record.predecessorCommit
		, recursiveCheckedRecordPromotionPredecessor);
	assert.equal(record.draftParentCommit
		, recursiveCheckedRecordPromotionDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, recursiveCheckedRecordPromotionChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, recursiveCheckedRecordPromotionAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		recursiveCheckedRecordPromotionChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeRecursiveCheckedRecordPromotionSource
		);
		const previous = git(["show"
			, `${recursiveCheckedRecordPromotionPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseRecursiveCheckedRecordPromotionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeRecursiveCheckedRecordPromotionSource(
			update.path, current), previous, update.path);
		assert.equal(beforeRecursiveCheckedRecordPromotionSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const unknown = current + "unknown";
		assert.equal(beforeRecursiveCheckedRecordPromotionSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRecursiveCheckedRecordPromotionUpdate(
				current, changed
			));
		}
	}
});

test("recursive checked-record promotion closes additions", async () => {
	const record = JSON.parse(await readFile(
		recursiveCheckedRecordPromotionHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${recursiveCheckedRecordPromotionPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("recursive checked-record inventory equals authenticated promotion", {
	timeout: 900_000
}, async () => {
	const inventoryPath = "docs/type-surface.v1.json";
	const original = JSON.parse(git(["show"
		, `${recursiveCheckedRecordPromotionPredecessor}:${inventoryPath}`]));
	const proposed = await promoteRecursiveCheckedRecords(
		original, await recursiveCheckedRecordReferences()
	);
	const document = JSON.parse(sourceAtHistoryMilestone(
		recursiveCheckedRecordPromotionHistoryPath, inventoryPath
	));
	assert.deepEqual(document, withHistoryMilestoneSourcePins(
		recursiveCheckedRecordPromotionHistoryPath, proposed
	));
	assert.equal(document.evidence.length, original.evidence.length + 36);
	assert.equal(document.observations.length, original.observations.length);
});

test("recursive checked-record promotion writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-recursive-record-promotion-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-recursive-checked-record-promotion-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
