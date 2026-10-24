/**
 * Preserve the source layer that turns archived WIT/WASI evidence into public
 * checked-record value-index support claims.
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
	beforeCheckedRecordValueIndexWitPromotionSource
	, checkedRecordValueIndexWitPromotionAddedSourcePaths
	, checkedRecordValueIndexWitPromotionChangedPaths
	, checkedRecordValueIndexWitPromotionDraftParent
	, checkedRecordValueIndexWitPromotionFoundationAddedPaths
	, checkedRecordValueIndexWitPromotionFoundationModifiedPaths
	, checkedRecordValueIndexWitPromotionHistoryPath
	, checkedRecordValueIndexWitPromotionPredecessor
	, reverseCheckedRecordValueIndexWitPromotionUpdate
} from "./checked-record-value-index-wit-promotion-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("hosted WIT/WASI value-index promotion has one reversible lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexWitPromotionHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "checked-record-value-index-wit-promotion-source-v1");
		assert.equal(record.predecessorCommit
			, checkedRecordValueIndexWitPromotionPredecessor);
		assert.equal(record.draftParentCommit
			, checkedRecordValueIndexWitPromotionDraftParent);
		assert.deepEqual(record.foundation.modifiedPaths
			, checkedRecordValueIndexWitPromotionFoundationModifiedPaths);
		assert.deepEqual(record.foundation.addedPaths
			, checkedRecordValueIndexWitPromotionFoundationAddedPaths);
		assert.deepEqual(record.updates.map(update => update.path)
			, checkedRecordValueIndexWitPromotionChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, checkedRecordValueIndexWitPromotionAddedSourcePaths);
		assert.equal(record.pathsSha256, sha256(JSON.stringify(
			checkedRecordValueIndexWitPromotionChangedPaths
		)));
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
					, beforeCheckedRecordValueIndexWitPromotionSource
			);
			const previous = git(["show"
				, `${checkedRecordValueIndexWitPromotionPredecessor}:${update.path}`]);
			assert.equal(sha256(current), update.currentSha256, update.path);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(reverseCheckedRecordValueIndexWitPromotionUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexWitPromotionSource(
				update.path, current), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexWitPromotionSource(
				update.path, current, update.currentSha256), current, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			const unknown = current + "unknown";
			assert.equal(beforeCheckedRecordValueIndexWitPromotionSource(
				update.path, unknown), unknown, update.path);
		}
		const sample = record.updates[0];
		const current = await sourceAtFinHistoryMilestone(
			sample.path, sample.currentSha256
			, beforeCheckedRecordValueIndexWitPromotionSource
		);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(sample); mutate(changed);
			assert.throws(() => reverseCheckedRecordValueIndexWitPromotionUpdate(
				current, changed));
		}
	}
);

test("hosted WIT/WASI value-index promotion closes its exact committed tree"
	, () => {
		const modified = git(["diff", "--name-only", "--diff-filter=M"
			, checkedRecordValueIndexWitPromotionPredecessor
			, checkedRecordValueIndexWitPromotionDraftParent])
			.trim().split("\n").filter(Boolean).sort();
		assert.deepEqual(modified
			, [...checkedRecordValueIndexWitPromotionFoundationModifiedPaths].sort());
		const added = git(["diff", "--name-only", "--diff-filter=A"
			, checkedRecordValueIndexWitPromotionPredecessor
			, checkedRecordValueIndexWitPromotionDraftParent])
			.trim().split("\n").filter(Boolean).sort();
		assert.deepEqual(added
			, [...checkedRecordValueIndexWitPromotionFoundationAddedPaths].sort());
	}
);

test("hosted WIT/WASI value-index promotion closes every added source"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexWitPromotionHistoryPath, "utf8"
		));
		// Later layers may edit an addition; reconstruct its recorded milestone bytes.
		for(const addition of record.additions)
		{
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
				, addition.currentSha256, addition.path);
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${checkedRecordValueIndexWitPromotionPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		}
	}
);

test("hosted WIT/WASI value-index promotion writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-wit-promotion-guard-"
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
			"scripts/update-checked-record-value-index-wit-promotion-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact promotion commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
