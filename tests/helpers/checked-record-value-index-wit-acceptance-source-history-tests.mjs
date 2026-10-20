/**
 * Exercise the installed WIT acceptance source layer and all added artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexWitAcceptanceSource
	, checkedRecordValueIndexWitAcceptanceAddedPaths
	, checkedRecordValueIndexWitAcceptanceChangedPaths
	, checkedRecordValueIndexWitAcceptanceHistoryPath
	, checkedRecordValueIndexWitAcceptancePredecessor
	, reverseCheckedRecordValueIndexWitAcceptanceUpdate
} from "./checked-record-value-index-wit-acceptance-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });

test("installed value-index WIT acceptance has one exact reversible source layer", async () => {
	const ledger = JSON.parse(await readFile(checkedRecordValueIndexWitAcceptanceHistoryPath, "utf8"));
	assert.equal(ledger.schemaVersion, 1);
	assert.equal(ledger.milestone, "checked-record-value-index-wit-acceptance-source-v1");
	assert.equal(ledger.predecessorCommit, checkedRecordValueIndexWitAcceptancePredecessor);
	assert.deepEqual(ledger.updates.map(item => item.path), checkedRecordValueIndexWitAcceptanceChangedPaths);
	assert.deepEqual(ledger.additions.map(item => item.path), checkedRecordValueIndexWitAcceptanceAddedPaths);
	assert.equal(ledger.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexWitAcceptanceChangedPaths
	)));
	for(const update of ledger.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeCheckedRecordValueIndexWitAcceptanceSource
		);
		const previous = git(["show", `${checkedRecordValueIndexWitAcceptancePredecessor}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexWitAcceptanceUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexWitAcceptanceSource(update.path, current)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of ledger.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
	}
	assert.equal(beforeCheckedRecordValueIndexWitAcceptanceSource("missing", "text"), "text");
});
