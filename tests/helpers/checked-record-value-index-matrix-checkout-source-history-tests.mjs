/**
 * Verify the exact hosted-checkout repair for the value-index matrix.
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
	beforeCheckedRecordValueIndexMatrixCheckoutSource
	, checkedRecordValueIndexMatrixCheckoutChangedPaths
	, checkedRecordValueIndexMatrixCheckoutDraftParent
	, checkedRecordValueIndexMatrixCheckoutFoundationAddedPaths
	, checkedRecordValueIndexMatrixCheckoutFoundationModifiedPaths
	, checkedRecordValueIndexMatrixCheckoutHistoryAddedPaths
	, checkedRecordValueIndexMatrixCheckoutHistoryPath
	, checkedRecordValueIndexMatrixCheckoutPredecessor
	, reverseCheckedRecordValueIndexMatrixCheckoutUpdate
} from "./checked-record-value-index-matrix-checkout-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const receiptCommit = "d8f87b3743790d99b1238cb0b78a4cfc8d9b8bf1";

test("value-index matrix hosted-checkout repair has one reversible lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexMatrixCheckoutHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "checked-record-value-index-matrix-checkout-source-v1");
		assert.equal(record.predecessorCommit
			, checkedRecordValueIndexMatrixCheckoutPredecessor);
		assert.equal(record.draftParentCommit
			, checkedRecordValueIndexMatrixCheckoutDraftParent);
		assert.deepEqual(record.foundation.modifiedPaths
			, checkedRecordValueIndexMatrixCheckoutFoundationModifiedPaths);
		assert.deepEqual(record.foundation.addedPaths
			, checkedRecordValueIndexMatrixCheckoutFoundationAddedPaths);
		assert.deepEqual(record.updates.map(update => update.path)
			, checkedRecordValueIndexMatrixCheckoutChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, checkedRecordValueIndexMatrixCheckoutHistoryAddedPaths);
		assert.equal(record.pathsSha256, sha256(JSON.stringify(
			checkedRecordValueIndexMatrixCheckoutChangedPaths
		)));
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
					, beforeCheckedRecordValueIndexMatrixCheckoutSource
			);
			const previous = git(["show"
				, `${checkedRecordValueIndexMatrixCheckoutPredecessor}:${update.path}`]);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(reverseCheckedRecordValueIndexMatrixCheckoutUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexMatrixCheckoutSource(
				update.path, current), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
	}
);

test("value-index matrix hosted-checkout repair closes its exact tree", () => {
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexMatrixCheckoutPredecessor
		, checkedRecordValueIndexMatrixCheckoutDraftParent])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...checkedRecordValueIndexMatrixCheckoutFoundationModifiedPaths].sort());
	const added = git(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexMatrixCheckoutPredecessor
		, checkedRecordValueIndexMatrixCheckoutDraftParent])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(added
		, [...checkedRecordValueIndexMatrixCheckoutFoundationAddedPaths].sort());
});

test("value-index matrix hosted-checkout repair closes every added source"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexMatrixCheckoutHistoryPath, "utf8"
		));
		for(const addition of record.additions)
		{
			assert.equal(sha256(git(["show", `${receiptCommit}:${addition.path}`]))
				, addition.currentSha256, addition.path);
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${checkedRecordValueIndexMatrixCheckoutPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		}
	}
);

test("value-index matrix hosted-checkout writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-matrix-checkout-guard-"
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
			"scripts/update-checked-record-value-index-matrix-checkout-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact repair commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
