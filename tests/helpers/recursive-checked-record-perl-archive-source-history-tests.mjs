/**
 * Prove three omitted archive-source transitions from Git history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeRecursiveCheckedRecordPerlArchiveSource
	, recursiveCheckedRecordPerlArchiveChangedPaths
	, recursiveCheckedRecordPerlArchiveCommit
	, recursiveCheckedRecordPerlArchiveHistoricalTransitions
	, recursiveCheckedRecordPerlArchiveHistoryPath
	, recursiveCheckedRecordPerlArchiveParent
	, recursiveCheckedRecordPerlArchivePrimaryChangedPaths
	, reverseRecursiveCheckedRecordPerlArchiveUpdate
	, throughRecursiveCheckedRecordPerlArchiveSource
} from "./recursive-checked-record-perl-archive-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

test("archive history reconstructs every omitted predecessor source", async () => {
	const record = JSON.parse(await readFile(
		recursiveCheckedRecordPerlArchiveHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "recursive-checked-record-perl-archive-source-v1");
	assert.equal(record.transitionCommit, recursiveCheckedRecordPerlArchiveCommit);
	assert.equal(record.transitionParent, recursiveCheckedRecordPerlArchiveParent);
	assert.equal(execFileSync("git", ["rev-parse", `${record.transitionCommit}^`]
		, { encoding: "utf8" }).trim(), record.transitionParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, recursiveCheckedRecordPerlArchivePrimaryChangedPaths);
	assert.deepEqual(record.historicalTransitions.map(transition => ({
		commit: transition.transitionCommit
		, parent: transition.transitionParent
		, paths: transition.updates.map(update => update.path)
	})), recursiveCheckedRecordPerlArchiveHistoricalTransitions);
	const transitions = [{
		transitionCommit: record.transitionCommit
		, transitionParent: record.transitionParent
		, updates: record.updates
	}
		, ...record.historicalTransitions
	];
	for(const transition of transitions)
	{
		assert.equal(execFileSync("git", ["rev-parse"
			, `${transition.transitionCommit}^`], { encoding: "utf8" }).trim()
		, transition.transitionParent);
		for(const update of transition.updates)
		{
			const current = execFileSync("git", ["show"
				, `${transition.transitionCommit}:${update.path}`], { encoding: "utf8" });
			const previous = execFileSync("git", ["show"
				, `${transition.transitionParent}:${update.path}`], { encoding: "utf8" });
			assert.equal(sha256(current), update.currentSha256, update.path);
			assert.equal(reverseRecursiveCheckedRecordPerlArchiveUpdate(
				current, update
			), previous);
			assert.equal(beforeRecursiveCheckedRecordPerlArchiveSource(
				update.path, current), previous);
			assert.equal(beforeRecursiveCheckedRecordPerlArchiveSource(
				update.path, current, update.currentSha256), current);
			assert.equal(beforeRecursiveCheckedRecordPerlArchiveSource(
				update.path, current + "unknown"), current + "unknown");
			for(const mutate of [
				item => { item.path = "unknown"; }
				, item => { item.previousSha256 = "0".repeat(64); }
				, item => { item.currentSha256 = "0".repeat(64); }
				, item => { item.edits = []; }
				, item => { item.edits[0].start = -1; }
				, item => { item.edits[0].current += "unknown"; }
			]) {
				const changed = structuredClone(update);
				mutate(changed);
				assert.throws(() => reverseRecursiveCheckedRecordPerlArchiveUpdate(
					current, changed
				));
			}
		}
	}
	const oldest = new Map();
	for(const transition of transitions) for(const update of transition.updates)
		oldest.set(update.path, transition.transitionParent);
	assert.deepEqual([...oldest.keys()].sort()
		, [...recursiveCheckedRecordPerlArchiveChangedPaths].sort());
	for(const [path, revision] of oldest)
	{
		const current = await readFile(path, "utf8");
		const previous = execFileSync("git", ["show", `${revision}:${path}`]
			, { encoding: "utf8" });
		assert.equal(throughRecursiveCheckedRecordPerlArchiveSource(
			path, current
		), previous, path);
		assert.equal(throughRecursiveCheckedRecordPerlArchiveSource(
			path, current + "unknown"
		), current + "unknown", path);
	}
});
