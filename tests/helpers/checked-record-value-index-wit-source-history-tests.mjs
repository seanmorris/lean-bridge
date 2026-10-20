/**
 * Exercise the WIT value-index source layer and every added source artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexWitSource, checkedRecordValueIndexWitAddedPaths
	, checkedRecordValueIndexWitChangedPaths, checkedRecordValueIndexWitHistoryPath
	, checkedRecordValueIndexWitPredecessor, reverseCheckedRecordValueIndexWitUpdate
} from "./checked-record-value-index-wit-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });

test("value-index WIT source foundation has an exact reversible lineage", async () => {
	const ledger = JSON.parse(await readFile(checkedRecordValueIndexWitHistoryPath, "utf8"));
	assert.equal(ledger.schemaVersion, 1);
	assert.equal(ledger.milestone, "checked-record-value-index-wit-foundation-source-v1");
	assert.equal(ledger.predecessorCommit, checkedRecordValueIndexWitPredecessor);
	assert.deepEqual(ledger.updates.map(item => item.path), checkedRecordValueIndexWitChangedPaths);
	assert.deepEqual(ledger.additions.map(item => item.path), checkedRecordValueIndexWitAddedPaths);
	assert.equal(ledger.pathsSha256, sha256(JSON.stringify(checkedRecordValueIndexWitChangedPaths)));
	for(const update of ledger.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeCheckedRecordValueIndexWitSource
		);
		const previous = git(["show", `${checkedRecordValueIndexWitPredecessor}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexWitUpdate(current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of ledger.additions)
		assert.equal(sha256(await readFile(addition.path)), addition.currentSha256, addition.path);
	assert.equal(beforeCheckedRecordValueIndexWitSource("missing", "text"), "text");
});
