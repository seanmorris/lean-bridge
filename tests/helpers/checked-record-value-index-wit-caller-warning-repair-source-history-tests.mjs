/** Prove the WIT result-only caller warning repair is exact and reversible. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexWitCallerWarningRepairSource
	, checkedRecordValueIndexWitCallerWarningRepairAddedPaths
	, checkedRecordValueIndexWitCallerWarningRepairChangedPaths
	, checkedRecordValueIndexWitCallerWarningRepairCurrentCommit
	, checkedRecordValueIndexWitCallerWarningRepairHistoricalPaths
	, checkedRecordValueIndexWitCallerWarningRepairHistoryPath
	, checkedRecordValueIndexWitCallerWarningRepairPreviousCommit
	, checkedRecordValueIndexWitCallerWarningRepairRegistrationParent
	, checkedRecordValueIndexWitCallerWarningRepairRegistrationPaths
	, reverseCheckedRecordValueIndexWitCallerWarningRepairUpdate
} from "./checked-record-value-index-wit-caller-warning-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("WIT caller warning repair has one reversible delayed lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexWitCallerWarningRepairHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "checked-record-value-index-wit-caller-warning-repair-v1");
	assert.equal(record.previousCommit, checkedRecordValueIndexWitCallerWarningRepairPreviousCommit);
	assert.equal(record.currentCommit, checkedRecordValueIndexWitCallerWarningRepairCurrentCommit);
	assert.equal(record.registrationParent, checkedRecordValueIndexWitCallerWarningRepairRegistrationParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexWitCallerWarningRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexWitCallerWarningRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexWitCallerWarningRepairChangedPaths
	)));
	for(const update of record.updates)
	{
		const historical = checkedRecordValueIndexWitCallerWarningRepairHistoricalPaths
			.includes(update.path);
		assert.equal(update.kind, historical ? "historical" : "registration");
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
				, beforeCheckedRecordValueIndexWitCallerWarningRepairSource
		);
		const previousCommit = historical
			? checkedRecordValueIndexWitCallerWarningRepairPreviousCommit
			: checkedRecordValueIndexWitCallerWarningRepairRegistrationParent;
		const previous = git(["show", `${previousCommit}:${update.path}`]);
		assert.equal(reverseCheckedRecordValueIndexWitCallerWarningRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.deepEqual(record.updates.filter(item => item.kind === "registration")
		.map(item => item.path), checkedRecordValueIndexWitCallerWarningRepairRegistrationPaths);
});

test("WIT caller warning repair closes its exact source commit", () => {
	assert.equal(git(["rev-parse", `${checkedRecordValueIndexWitCallerWarningRepairCurrentCommit}^`]).trim()
		, checkedRecordValueIndexWitCallerWarningRepairPreviousCommit);
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexWitCallerWarningRepairPreviousCommit
		, checkedRecordValueIndexWitCallerWarningRepairCurrentCommit])
		.trim().split("\n").filter(Boolean), checkedRecordValueIndexWitCallerWarningRepairHistoricalPaths);
});

test("WIT caller warning repair closes every added verifier source", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexWitCallerWarningRepairHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexWitCallerWarningRepairRegistrationParent}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("WIT caller warning repair leaves result-only recovery uncompiled", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexWitCallerWarningRepairHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.kind === "historical");
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
			, beforeCheckedRecordValueIndexWitCallerWarningRepairSource
	);
	assert.match(current, /#ifndef VALUE_INDEX_RESULT_ONLY\nstatic void recover\(void\)/u);
});
