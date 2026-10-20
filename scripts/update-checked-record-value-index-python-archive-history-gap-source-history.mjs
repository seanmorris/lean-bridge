#!/usr/bin/env node
/**
 * Record the omitted Python archive-history hub transition from exact Git
 * blobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	checkedRecordValueIndexPythonArchiveHistoryGapAddedPaths
	, checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit
	, checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths
	, checkedRecordValueIndexPythonArchiveHistoryGapPath
	, checkedRecordValueIndexPythonArchiveHistoryGapPreviousCommit
	, reverseCheckedRecordValueIndexPythonArchiveHistoryGapUpdate
} from "../tests/helpers/checked-record-value-index-python-archive-history-gap-source-history.mjs";
import { checkedRecordValueIndexWitVerifierRepairDraftParent } from "../tests/helpers/checked-record-value-index-wit-verifier-repair-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexWitVerifierRepairDraftParent
	, "Python archive-history gap writer must stay on the exact WIT repair parent");
assert.equal(git(["rev-parse"
	, `${checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit}^`]).trim()
, checkedRecordValueIndexPythonArchiveHistoryGapPreviousCommit);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit}:${checkedRecordValueIndexPythonArchiveHistoryGapPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite a historical ledger");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-python-archive-gap-history-"
));
try
{
	const edits = async (previous, current) => {
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
		)].map(match => {
			const previousCount = Number(match[2] ?? 1);
			const currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return {
				start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart
					, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart
					, currentStart + currentCount).join("")
			};
		});
		assert.ok(result.length > 0);
		return result;
	};
	const historicalTransitions = [];
	for(const path of checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths)
	{
		const previous = git(["show"
			, `${checkedRecordValueIndexPythonArchiveHistoryGapPreviousCommit}:${path}`]);
		const current = git(["show"
			, `${checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit}:${path}`]);
		const update = {
			path, previousSha256: sha256(previous)
			, currentSha256: sha256(current)
			, edits: await edits(previous, current)
		};
		assert.equal(reverseCheckedRecordValueIndexPythonArchiveHistoryGapUpdate(
			current, update), previous, path);
		historicalTransitions.push(update);
	}
	const additions = [];
	for(const path of checkedRecordValueIndexPythonArchiveHistoryGapAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(checkedRecordValueIndexPythonArchiveHistoryGapPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-python-archive-history-gap-v1"
			, previousCommit: checkedRecordValueIndexPythonArchiveHistoryGapPreviousCommit
			, currentCommit: checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths))
			, additions, historicalTransitions
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write("Recorded the omitted Python archive-history hub transition.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
