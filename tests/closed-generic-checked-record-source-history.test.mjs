/**
 * Bind the closed-generic checked-record extractor correction to its exact
 * predecessor and refreshed type-surface pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface } from "../src/adoption/type-surface.mjs";
import {
	beforeClosedGenericCheckedRecordSource
	, closedGenericCheckedRecordChangedPaths
	, closedGenericCheckedRecordHistoryPath
	, closedGenericCheckedRecordPredecessor
	, reverseClosedGenericCheckedRecordUpdate
} from "./helpers/closed-generic-checked-record-source-history.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";
import { beforeTestProfileBacklogRepairSource } from "./helpers/test-profile-backlog-repair-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});

test("closed generic checked-record correction has an exact reversible source transition", async () => {
	const record = JSON.parse(await readFile(
		closedGenericCheckedRecordHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "closed-generic-checked-record-source-v1");
	assert.equal(record.predecessorCommit, closedGenericCheckedRecordPredecessor);
	assert.deepEqual(record.updates.map(item => item.path).sort()
		, [...closedGenericCheckedRecordChangedPaths].sort());
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const repositoryPrevious = git([
			"show", `${closedGenericCheckedRecordPredecessor}:${update.path}`
		]);
		const previous = reverseClosedGenericCheckedRecordUpdate(current, update);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(beforeTestProfileBacklogRepairSource(
			update.path, previous
		), repositoryPrevious, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, sha256(repositoryPrevious)
		), repositoryPrevious, update.path);
		assert.equal(beforeClosedGenericCheckedRecordSource(
			update.path, `${current}\n`, update.previousSha256
		), `${current}\n`, `${update.path}: unknown edits are preserved`);
	}
});

test("closed generic checked-record correction refreshes every live extractor pin", async () => {
	const { document: inventory } = await readTypeSurface();
	const extractor = "src/analyze/NativeExports.lean";
	const digest = sha256(await readFile(extractor));
	let pins = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
	{
		if(file.path !== extractor) continue;
		assert.equal(file.sha256, digest, entry.id);
		pins++;
	}
	assert.equal(pins, 155);
});
