/**
 * Prove the Rust source-inventory verifier repair is exact and reversible.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexRustInventoryRepairSource
	, checkedRecordValueIndexRustInventoryRepairAddedPaths
	, checkedRecordValueIndexRustInventoryRepairChangedPaths
	, checkedRecordValueIndexRustInventoryRepairCurrentCommit
	, checkedRecordValueIndexRustInventoryRepairHistoricalPaths
	, checkedRecordValueIndexRustInventoryRepairHistoryPath
	, checkedRecordValueIndexRustInventoryRepairPreviousCommit
	, checkedRecordValueIndexRustInventoryRepairRegistrationParent
	, checkedRecordValueIndexRustInventoryRepairRegistrationPaths
	, reverseCheckedRecordValueIndexRustInventoryRepairUpdate
} from "./checked-record-value-index-rust-inventory-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("Rust inventory verifier repair has one reversible delayed lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRustInventoryRepairHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "checked-record-value-index-rust-inventory-repair-v1");
	assert.equal(record.previousCommit, checkedRecordValueIndexRustInventoryRepairPreviousCommit);
	assert.equal(record.currentCommit, checkedRecordValueIndexRustInventoryRepairCurrentCommit);
	assert.equal(record.registrationParent, checkedRecordValueIndexRustInventoryRepairRegistrationParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexRustInventoryRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexRustInventoryRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexRustInventoryRepairChangedPaths
	)));
	for(const update of record.updates)
	{
		const historical = checkedRecordValueIndexRustInventoryRepairHistoricalPaths
			.includes(update.path);
		assert.equal(update.kind, historical ? "historical" : "registration");
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
				, beforeCheckedRecordValueIndexRustInventoryRepairSource
		);
		const previousCommit = historical
			? checkedRecordValueIndexRustInventoryRepairPreviousCommit
			: checkedRecordValueIndexRustInventoryRepairRegistrationParent;
		const previous = git(["show", `${previousCommit}:${update.path}`]);
		assert.equal(reverseCheckedRecordValueIndexRustInventoryRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.deepEqual(record.updates.filter(item => item.kind === "registration")
		.map(item => item.path), checkedRecordValueIndexRustInventoryRepairRegistrationPaths);
});

test("Rust inventory verifier repair closes its exact source commit", () => {
	assert.equal(git(["rev-parse", `${checkedRecordValueIndexRustInventoryRepairCurrentCommit}^`]).trim()
		, checkedRecordValueIndexRustInventoryRepairPreviousCommit);
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexRustInventoryRepairPreviousCommit
		, checkedRecordValueIndexRustInventoryRepairCurrentCommit])
		.trim().split("\n").filter(Boolean), checkedRecordValueIndexRustInventoryRepairHistoricalPaths);
});

test("Rust inventory verifier repair closes every added verifier source", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRustInventoryRepairHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexRustInventoryRepairRegistrationParent}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("Rust inventory verifier authenticates fields emitted by lakeInputState", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRustInventoryRepairHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.kind === "historical");
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
			, beforeCheckedRecordValueIndexRustInventoryRepairSource
	);
	assert.match(current, /assert\.equal\(moduleInput\.sha256, sha256\(source\)\);/u);
	assert.match(current, /moduleInput\.mode & 0o170000/u);
	assert.doesNotMatch(current, /moduleInput\.bytes/u);
});
