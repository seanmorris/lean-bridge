/**
 * Verify the final value-index matrix evidence-pin repair and wiring.
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
	beforeCheckedRecordValueIndexMatrixEvidencePinRepairSource
	, checkedRecordValueIndexMatrixEvidencePinRepairAddedPaths
	, checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths
	, checkedRecordValueIndexMatrixEvidencePinRepairDraftParent
	, checkedRecordValueIndexMatrixEvidencePinRepairHistoryPath
	, checkedRecordValueIndexMatrixEvidencePinRepairPins
	, checkedRecordValueIndexMatrixEvidencePinRepairPredecessor
	, reverseCheckedRecordValueIndexMatrixEvidencePinRepairUpdate
} from "./checked-record-value-index-matrix-evidence-pin-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const applyRecordedUpdate = (previous, update) => {
	assert.equal(sha256(previous), update.previousSha256, update.path);
	if(Array.isArray(update.replacements))
	{
		let current = previous;
		for(const replacement of update.replacements)
		{
			assert.equal(current.split(replacement.previous).length - 1
				, replacement.count);
			current = current.replaceAll(
				replacement.previous, replacement.current);
		}
		assert.equal(sha256(current), update.currentSha256, update.path);
		return current;
	}
	assert.ok(Array.isArray(update.edits));
	let previousCursor = 0, currentCursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		const unchangedLength = edit.start - currentCursor;
		assert.ok(unchangedLength >= 0);
		parts.push(previous.slice(previousCursor
			, previousCursor + unchangedLength), edit.current);
		previousCursor += unchangedLength;
		assert.equal(previous.slice(previousCursor
			, previousCursor + edit.previous.length), edit.previous);
		previousCursor += edit.previous.length;
		currentCursor = edit.start + edit.current.length;
	}
	parts.push(previous.slice(previousCursor));
	const current = parts.join("");
	assert.equal(sha256(current), update.currentSha256, update.path);
	return current;
};

test("value-index matrix evidence-pin repair has one reversible lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexMatrixEvidencePinRepairHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "checked-record-value-index-matrix-evidence-pin-repair-source-v1");
		assert.equal(record.predecessorCommit
			, checkedRecordValueIndexMatrixEvidencePinRepairPredecessor);
		assert.equal(record.draftParentCommit
			, checkedRecordValueIndexMatrixEvidencePinRepairDraftParent);
		assert.equal(record.predecessorCommit, record.draftParentCommit);
		assert.deepEqual(record.updates.map(update => update.path)
			, checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, checkedRecordValueIndexMatrixEvidencePinRepairAddedPaths);
		assert.equal(record.pathsSha256, sha256(JSON.stringify(
			checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths
		)));
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
					, beforeCheckedRecordValueIndexMatrixEvidencePinRepairSource
			);
			const previous = git(["show"
				, `${checkedRecordValueIndexMatrixEvidencePinRepairPredecessor}:${update.path}`]);
			assert.equal(reverseCheckedRecordValueIndexMatrixEvidencePinRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexMatrixEvidencePinRepairSource(
				update.path, current), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
	}
);

test("value-index matrix evidence-pin repair closes pins and additions"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexMatrixEvidencePinRepairHistoryPath, "utf8"
		));
		assert.equal(record.pinCount, 72);
		assert.deepEqual(record.pinUpdates
			, checkedRecordValueIndexMatrixEvidencePinRepairPins);
		const inventoryUpdate = record.updates.find(update =>
			update.path === "docs/type-surface.v1.json");
		assert.ok(inventoryUpdate);
		const inventory = JSON.parse(applyRecordedUpdate(git(["show"
			, `${checkedRecordValueIndexMatrixEvidencePinRepairPredecessor}`
				+ `:${inventoryUpdate.path}`]), inventoryUpdate));
		for(const pin of checkedRecordValueIndexMatrixEvidencePinRepairPins)
		{
			const matches = inventory.evidence.flatMap(evidence => evidence.files)
				.filter(file => file.path === pin.path);
			assert.equal(matches.length, pin.count, pin.path);
			assert.ok(matches.every(file => file.sha256 === pin.currentSha256)
				, pin.path);
		}
		for(const addition of record.additions)
		{
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256
				, beforeCheckedRecordValueIndexMatrixEvidencePinRepairSource))
				, addition.currentSha256, addition.path);
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${checkedRecordValueIndexMatrixEvidencePinRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		}
	}
);

test("value-index matrix evidence-pin writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-matrix-evidence-pin-guard-"
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
			"scripts/update-checked-record-value-index-matrix-evidence-pin-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact draft parent/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
