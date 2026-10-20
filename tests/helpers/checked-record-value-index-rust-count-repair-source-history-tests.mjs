/**
 * Preserve the delayed Rust value-index receipt-count repair and its current
 * registration as one exact reversible history layer.
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
	beforeCheckedRecordValueIndexRustCountRepairSource
	, checkedRecordValueIndexRustCountRepairAddedPaths
	, checkedRecordValueIndexRustCountRepairChangedPaths
	, checkedRecordValueIndexRustCountRepairCurrentCommit
	, checkedRecordValueIndexRustCountRepairHistoricalPaths
	, checkedRecordValueIndexRustCountRepairHistoryPath
	, checkedRecordValueIndexRustCountRepairPreviousCommit
	, checkedRecordValueIndexRustCountRepairRegistrationParent
	, checkedRecordValueIndexRustCountRepairRegistrationPaths
	, reverseCheckedRecordValueIndexRustCountRepairUpdate
} from "./checked-record-value-index-rust-count-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("Rust value-index count repair has one reversible delayed lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexRustCountRepairHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "checked-record-value-index-rust-count-repair-v1");
		assert.equal(record.previousCommit
			, checkedRecordValueIndexRustCountRepairPreviousCommit);
		assert.equal(record.currentCommit
			, checkedRecordValueIndexRustCountRepairCurrentCommit);
		assert.equal(record.registrationParent
			, checkedRecordValueIndexRustCountRepairRegistrationParent);
		assert.deepEqual(record.updates.map(update => update.path)
			, checkedRecordValueIndexRustCountRepairChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, checkedRecordValueIndexRustCountRepairAddedPaths);
		assert.equal(record.pathsSha256, sha256(JSON.stringify(
			checkedRecordValueIndexRustCountRepairChangedPaths
		)));
		for(const update of record.updates)
		{
			const historical = checkedRecordValueIndexRustCountRepairHistoricalPaths
				.includes(update.path);
			assert.equal(update.kind
				, historical ? "historical" : "registration", update.path);
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
					, beforeCheckedRecordValueIndexRustCountRepairSource
			);
			const previousCommit = historical
				? checkedRecordValueIndexRustCountRepairPreviousCommit
				: checkedRecordValueIndexRustCountRepairRegistrationParent;
			const previous = git(["show", `${previousCommit}:${update.path}`]);
			assert.equal(sha256(current), update.currentSha256, update.path);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(reverseCheckedRecordValueIndexRustCountRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexRustCountRepairSource(
				update.path, current), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexRustCountRepairSource(
				update.path, current, update.currentSha256), current, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			assert.equal(beforeCheckedRecordValueIndexRustCountRepairSource(
				update.path, current + "unknown"), current + "unknown", update.path);
		}
		assert.deepEqual(record.updates
			.filter(update => update.kind === "historical")
			.map(update => update.path)
			, checkedRecordValueIndexRustCountRepairHistoricalPaths);
		assert.deepEqual(record.updates
			.filter(update => update.kind === "registration")
			.map(update => update.path)
			, checkedRecordValueIndexRustCountRepairRegistrationPaths);
	}
);

test("Rust value-index count repair closes the exact historical commit", () => {
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexRustCountRepairPreviousCommit
		, checkedRecordValueIndexRustCountRepairCurrentCommit])
		.trim().split("\n").filter(Boolean).sort()
	, [...checkedRecordValueIndexRustCountRepairHistoricalPaths].sort());
	assert.equal(git(["rev-parse"
		, `${checkedRecordValueIndexRustCountRepairCurrentCommit}^`]).trim()
		, checkedRecordValueIndexRustCountRepairPreviousCommit);
});

test("Rust value-index count repair closes every history source addition"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexRustCountRepairHistoryPath, "utf8"
		));
		for(const addition of record.additions)
		{
			const current = await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256
			);
			assert.equal(sha256(current), addition.currentSha256, addition.path);
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${checkedRecordValueIndexRustCountRepairRegistrationParent}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
		}
	}
);

test("Rust value-index count-repair writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-rust-count-guard-"
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
			"scripts/update-checked-record-value-index-rust-count-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact registration parent/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
