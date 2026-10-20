/**
 * Verify the omitted history-hub and Rust expectation transitions.
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
	beforeCheckedRecordValueIndexMatrixHistoryGapSource
	, checkedRecordValueIndexMatrixHistoryGapAddedPaths
	, checkedRecordValueIndexMatrixHistoryGapChangedPaths
	, checkedRecordValueIndexMatrixHistoryGapDraftParent
	, checkedRecordValueIndexMatrixHistoryGapHistoricalPaths
	, checkedRecordValueIndexMatrixHistoryGapPath
	, checkedRecordValueIndexMatrixHistoryGapPredecessor
	, reverseCheckedRecordValueIndexMatrixHistoricalGapUpdate
	, reverseCheckedRecordValueIndexMatrixHistoryGapUpdate
} from "./checked-record-value-index-matrix-history-gap-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const hubPath = "tests/helpers/fin-refinement-source-history.mjs";
const typeTestPath = "tests/type-surface.test.mjs";
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const receiptCommit = "ef8a07504d8c78326d58deac2fbf19f7f9290356";

test("value-index matrix history gaps have one exact reversible lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexMatrixHistoryGapPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "checked-record-value-index-matrix-history-gap-source-v1");
		assert.equal(record.predecessorCommit
			, checkedRecordValueIndexMatrixHistoryGapPredecessor);
		assert.equal(record.draftParentCommit
			, checkedRecordValueIndexMatrixHistoryGapDraftParent);
		assert.deepEqual(record.updates.map(item => item.path)
			, checkedRecordValueIndexMatrixHistoryGapChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, checkedRecordValueIndexMatrixHistoryGapAddedPaths);
		assert.deepEqual(checkedRecordValueIndexMatrixHistoryGapHistoricalPaths
			, [typeTestPath, hubPath]);
		assert.equal(record.historicalTransitions.length, 9);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
					, beforeCheckedRecordValueIndexMatrixHistoryGapSource
			);
			const previous = git(["show"
				, `${checkedRecordValueIndexMatrixHistoryGapPredecessor}:${update.path}`]);
			assert.equal(reverseCheckedRecordValueIndexMatrixHistoryGapUpdate(
				current, update), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const transition of record.historicalTransitions)
		{
			const previous = git(["show"
				, `${transition.previousCommit}:${transition.path}`]);
			const current = git(["show"
				, `${transition.currentCommit}:${transition.path}`]);
			assert.equal(sha256(previous), transition.previousSha256);
			assert.equal(sha256(current), transition.currentSha256);
			assert.equal(reverseCheckedRecordValueIndexMatrixHistoricalGapUpdate(
				current, transition), previous);
		}
		const hub = await readFile(hubPath, "utf8");
		assert.equal(beforeCheckedRecordValueIndexMatrixHistoryGapSource(
			hubPath, hub), git(["show", `d7531e61b1d3ed9ae2eb569d2d3f20ae33eb62df:${hubPath}`]));
		const typeTest = git(["show"
			, `d7531e61b1d3ed9ae2eb569d2d3f20ae33eb62df:${typeTestPath}`]);
		assert.equal(beforeCheckedRecordValueIndexMatrixHistoryGapSource(
			typeTestPath, typeTest), git(["show"
			, `42c40d8d54895be99bfcd2ee6856357919f55113:${typeTestPath}`]));
	}
);

test("value-index matrix history gap closes every added source", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexMatrixHistoryGapPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.equal(sha256(git(["show", `${receiptCommit}:${addition.path}`]))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexMatrixHistoryGapPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("value-index matrix history-gap writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-matrix-history-gap-guard-"
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
			"scripts/update-checked-record-value-index-matrix-history-gap-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact draft parent/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
