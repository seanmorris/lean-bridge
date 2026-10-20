/**
 * Exercise the native TAP contract repair source layer and all added artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeValueIndexNativeTapContractSource
	, valueIndexNativeTapContractAddedPaths
	, valueIndexNativeTapContractChangedPaths
	, valueIndexNativeTapContractHistoryPath
	, valueIndexNativeTapContractPredecessor
	, reverseValueIndexNativeTapContractUpdate
} from "./value-index-native-tap-contract-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });

test("value-index native TAP contract repair has one exact reversible source layer", async () => {
	const ledger = JSON.parse(await readFile(valueIndexNativeTapContractHistoryPath, "utf8"));
	assert.equal(ledger.schemaVersion, 1);
	assert.equal(ledger.milestone, "value-index-native-tap-contract-source-v1");
	assert.equal(ledger.predecessorCommit, valueIndexNativeTapContractPredecessor);
	assert.deepEqual(ledger.updates.map(item => item.path), valueIndexNativeTapContractChangedPaths);
	assert.deepEqual(ledger.additions.map(item => item.path), valueIndexNativeTapContractAddedPaths);
	assert.equal(ledger.pathsSha256, sha256(JSON.stringify(
		valueIndexNativeTapContractChangedPaths
	)));
	for(const update of ledger.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeValueIndexNativeTapContractSource
		);
		const previous = git(["show", `${valueIndexNativeTapContractPredecessor}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseValueIndexNativeTapContractUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeValueIndexNativeTapContractSource(update.path, current)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of ledger.additions)
		assert.equal(sha256(await readFile(addition.path)), addition.currentSha256, addition.path);
	assert.equal(beforeValueIndexNativeTapContractSource("missing", "text"), "text");
});
