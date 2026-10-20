/**
 * Verify the exact value-index matrix lint repair and history wiring.
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
	beforeCheckedRecordValueIndexMatrixLintSource
	, checkedRecordValueIndexMatrixLintAddedPaths
	, checkedRecordValueIndexMatrixLintChangedPaths
	, checkedRecordValueIndexMatrixLintDraftParent
	, checkedRecordValueIndexMatrixLintFoundationModifiedPaths
	, checkedRecordValueIndexMatrixLintHistoryPath
	, checkedRecordValueIndexMatrixLintPredecessor
	, reverseCheckedRecordValueIndexMatrixLintUpdate
} from "./checked-record-value-index-matrix-lint-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

test("value-index matrix lint repair has one exact reversible lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexMatrixLintHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "checked-record-value-index-matrix-lint-source-v1");
		assert.equal(record.predecessorCommit
			, checkedRecordValueIndexMatrixLintPredecessor);
		assert.equal(record.draftParentCommit
			, checkedRecordValueIndexMatrixLintDraftParent);
		assert.deepEqual(record.foundation.modifiedPaths
			, checkedRecordValueIndexMatrixLintFoundationModifiedPaths);
		assert.deepEqual(record.foundation.addedPaths, []);
		assert.deepEqual(record.updates.map(update => update.path)
			, checkedRecordValueIndexMatrixLintChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, checkedRecordValueIndexMatrixLintAddedPaths);
		assert.equal(record.pathsSha256, sha256(JSON.stringify(
			checkedRecordValueIndexMatrixLintChangedPaths
		)));
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
					, beforeCheckedRecordValueIndexMatrixLintSource
			);
			const previous = git(["show"
				, `${checkedRecordValueIndexMatrixLintPredecessor}:${update.path}`]);
			assert.equal(reverseCheckedRecordValueIndexMatrixLintUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexMatrixLintSource(
				update.path, current), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
	}
);

test("value-index matrix lint repair closes its exact foundation", () => {
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexMatrixLintPredecessor
		, checkedRecordValueIndexMatrixLintDraftParent])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...checkedRecordValueIndexMatrixLintFoundationModifiedPaths].sort());
	const added = git(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexMatrixLintPredecessor
		, checkedRecordValueIndexMatrixLintDraftParent])
		.trim().split("\n").filter(Boolean);
	assert.deepEqual(added, []);
});

test("value-index matrix lint repair closes every added source", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexMatrixLintHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexMatrixLintPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("value-index matrix lint writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-value-index-matrix-lint-guard-"
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
		"scripts/update-checked-record-value-index-matrix-lint-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact lint commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
