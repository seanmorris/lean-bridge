/**
 * Verify the exact value-index matrix type-surface pin repair and wiring.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import "./checked-record-value-index-matrix-evidence-pin-repair-source-history-tests.mjs";
import {
	beforeCheckedRecordValueIndexMatrixPinRepairSource
	, checkedRecordValueIndexMatrixPinRepairAddedPaths
	, checkedRecordValueIndexMatrixPinRepairChangedPaths
	, checkedRecordValueIndexMatrixPinRepairDraftParent
	, checkedRecordValueIndexMatrixPinRepairFoundationModifiedPaths
	, checkedRecordValueIndexMatrixPinRepairHistoryPath
	, checkedRecordValueIndexMatrixPinRepairPins
	, checkedRecordValueIndexMatrixPinRepairPredecessor
	, reverseCheckedRecordValueIndexMatrixPinRepairUpdate
} from "./checked-record-value-index-matrix-pin-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

test("value-index matrix pin repair has one exact reversible lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexMatrixPinRepairHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "checked-record-value-index-matrix-pin-repair-source-v1");
		assert.equal(record.predecessorCommit
			, checkedRecordValueIndexMatrixPinRepairPredecessor);
		assert.equal(record.draftParentCommit
			, checkedRecordValueIndexMatrixPinRepairDraftParent);
		assert.deepEqual(record.foundation.modifiedPaths
			, checkedRecordValueIndexMatrixPinRepairFoundationModifiedPaths);
		assert.deepEqual(record.foundation.addedPaths, []);
		assert.deepEqual(record.updates.map(update => update.path)
			, checkedRecordValueIndexMatrixPinRepairChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, checkedRecordValueIndexMatrixPinRepairAddedPaths);
		assert.equal(record.pathsSha256, sha256(JSON.stringify(
			checkedRecordValueIndexMatrixPinRepairChangedPaths
		)));
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
					, beforeCheckedRecordValueIndexMatrixPinRepairSource
			);
			const previous = git(["show"
				, `${checkedRecordValueIndexMatrixPinRepairPredecessor}:${update.path}`]);
			assert.equal(reverseCheckedRecordValueIndexMatrixPinRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexMatrixPinRepairSource(
				update.path, current), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
	}
);

test("value-index matrix pin repair closes its exact foundation", () => {
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexMatrixPinRepairPredecessor
		, checkedRecordValueIndexMatrixPinRepairDraftParent])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...checkedRecordValueIndexMatrixPinRepairFoundationModifiedPaths].sort());
	const added = git(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexMatrixPinRepairPredecessor
		, checkedRecordValueIndexMatrixPinRepairDraftParent])
		.trim().split("\n").filter(Boolean);
	assert.deepEqual(added, []);
});

test("value-index matrix pin repair closes pins and added sources", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexMatrixPinRepairHistoryPath, "utf8"
	));
	assert.equal(record.pinCount, 94);
	assert.deepEqual(record.pinUpdates
		, checkedRecordValueIndexMatrixPinRepairPins);
	const inventory = JSON.parse(await readFile(
		"docs/type-surface.v1.json", "utf8"
	));
	for(const pin of checkedRecordValueIndexMatrixPinRepairPins)
	{
		const matches = inventory.evidence.flatMap(evidence => evidence.files)
			.filter(file => file.path === pin.path);
		assert.equal(matches.length, pin.count, pin.path);
		assert.ok(matches.every(file => file.sha256 === pin.currentSha256)
			, pin.path);
	}
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeCheckedRecordValueIndexMatrixPinRepairSource
		);
		assert.equal(sha256(current)
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexMatrixPinRepairPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("value-index matrix pin writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-value-index-matrix-pin-guard-"
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
		"scripts/update-checked-record-value-index-matrix-pin-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact repair commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
