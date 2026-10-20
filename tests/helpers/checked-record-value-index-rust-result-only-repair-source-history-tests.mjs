/**
 * Preserve the Rust result-only caller warning repair and its registration as
 * one exact reversible history layer.
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
	beforeCheckedRecordValueIndexRustResultOnlyRepairSource
	, checkedRecordValueIndexRustResultOnlyRepairAddedPaths
	, checkedRecordValueIndexRustResultOnlyRepairChangedPaths
	, checkedRecordValueIndexRustResultOnlyRepairCurrentCommit
	, checkedRecordValueIndexRustResultOnlyRepairHistoricalPaths
	, checkedRecordValueIndexRustResultOnlyRepairHistoryPath
	, checkedRecordValueIndexRustResultOnlyRepairPreviousCommit
	, checkedRecordValueIndexRustResultOnlyRepairRegistrationParent
	, checkedRecordValueIndexRustResultOnlyRepairRegistrationPaths
	, reverseCheckedRecordValueIndexRustResultOnlyRepairUpdate
} from "./checked-record-value-index-rust-result-only-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("Rust result-only warning repair has one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRustResultOnlyRepairHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-value-index-rust-result-only-repair-v1");
	assert.equal(record.previousCommit
		, checkedRecordValueIndexRustResultOnlyRepairPreviousCommit);
	assert.equal(record.currentCommit
		, checkedRecordValueIndexRustResultOnlyRepairCurrentCommit);
	assert.equal(record.registrationParent
		, checkedRecordValueIndexRustResultOnlyRepairRegistrationParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexRustResultOnlyRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexRustResultOnlyRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexRustResultOnlyRepairChangedPaths
	)));
	for(const update of record.updates)
	{
		const historical
			= checkedRecordValueIndexRustResultOnlyRepairHistoricalPaths
				.includes(update.path);
		assert.equal(update.kind, historical ? "historical" : "registration");
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedRecordValueIndexRustResultOnlyRepairSource
		);
		const previousCommit = historical
			? checkedRecordValueIndexRustResultOnlyRepairPreviousCommit
			: checkedRecordValueIndexRustResultOnlyRepairRegistrationParent;
		const previous = git(["show", `${previousCommit}:${update.path}`]);
		assert.equal(reverseCheckedRecordValueIndexRustResultOnlyRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexRustResultOnlyRepairSource(
			update.path, current), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.deepEqual(record.updates.filter(item => item.kind === "historical")
		.map(item => item.path)
		, checkedRecordValueIndexRustResultOnlyRepairHistoricalPaths);
	assert.deepEqual(record.updates.filter(item => item.kind === "registration")
		.map(item => item.path)
		, checkedRecordValueIndexRustResultOnlyRepairRegistrationPaths);
});

test("Rust result-only warning repair closes the exact repair commit", () => {
	assert.equal(git(["rev-parse"
		, `${checkedRecordValueIndexRustResultOnlyRepairCurrentCommit}^`]).trim()
		, checkedRecordValueIndexRustResultOnlyRepairPreviousCommit);
	assert.deepEqual(git(["diff", "--name-only"
		, checkedRecordValueIndexRustResultOnlyRepairPreviousCommit
		, checkedRecordValueIndexRustResultOnlyRepairCurrentCommit])
		.trim().split("\n").filter(Boolean).sort()
		, [...checkedRecordValueIndexRustResultOnlyRepairHistoricalPaths].sort());
});

test("Rust result-only repair closes every history source addition", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRustResultOnlyRepairHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexRustResultOnlyRepairRegistrationParent}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("Rust result-only repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-value-index-rust-result-only-guard-"
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
		"scripts/update-checked-record-value-index-rust-result-only-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact registration parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
