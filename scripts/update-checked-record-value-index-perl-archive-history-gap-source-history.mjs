#!/usr/bin/env node
/**
 * Record the omitted Perl archive-history hub transition from exact Git blobs.
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
	checkedRecordValueIndexPerlArchiveHistoryGapAddedPaths
	, checkedRecordValueIndexPerlArchiveHistoryGapCurrentCommit
	, checkedRecordValueIndexPerlArchiveHistoryGapHistoricalPaths
	, checkedRecordValueIndexPerlArchiveHistoryGapPath
	, checkedRecordValueIndexPerlArchiveHistoryGapPreviousCommit
	, reverseCheckedRecordValueIndexPerlArchiveHistoryGapUpdate
} from "../tests/helpers/checked-record-value-index-perl-archive-history-gap-source-history.mjs";
import { checkedRecordValueIndexPerlPromotionDraftParent } from "../tests/helpers/checked-record-value-index-perl-promotion-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexPerlPromotionDraftParent
	, "Perl archive-history gap writer must stay on the exact promotion parent");
assert.equal(git(["rev-parse"
	, `${checkedRecordValueIndexPerlArchiveHistoryGapCurrentCommit}^`]).trim()
, checkedRecordValueIndexPerlArchiveHistoryGapPreviousCommit);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexPerlArchiveHistoryGapCurrentCommit}:${checkedRecordValueIndexPerlArchiveHistoryGapPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite a historical ledger");

const draft = await readFile(checkedRecordValueIndexPerlArchiveHistoryGapPath
	, "utf8").then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.previousCommit
		, checkedRecordValueIndexPerlArchiveHistoryGapPreviousCommit);
	assert.equal(draft.currentCommit
		, checkedRecordValueIndexPerlArchiveHistoryGapCurrentCommit);
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-perl-archive-gap-history-"
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
	for(const path of checkedRecordValueIndexPerlArchiveHistoryGapHistoricalPaths)
	{
		const previous = git(["show"
			, `${checkedRecordValueIndexPerlArchiveHistoryGapPreviousCommit}:${path}`]);
		const current = git(["show"
			, `${checkedRecordValueIndexPerlArchiveHistoryGapCurrentCommit}:${path}`]);
		const update = {
			path, previousSha256: sha256(previous), currentSha256: sha256(current)
			, edits: await edits(previous, current)
		};
		assert.equal(reverseCheckedRecordValueIndexPerlArchiveHistoryGapUpdate(
			current, update), previous, path);
		historicalTransitions.push(update);
	}
	const additions = [];
	for(const path of checkedRecordValueIndexPerlArchiveHistoryGapAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexPerlArchiveHistoryGapCurrentCommit}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(checkedRecordValueIndexPerlArchiveHistoryGapPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-perl-archive-history-gap-v1"
			, previousCommit: checkedRecordValueIndexPerlArchiveHistoryGapPreviousCommit
			, currentCommit: checkedRecordValueIndexPerlArchiveHistoryGapCurrentCommit
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexPerlArchiveHistoryGapHistoricalPaths))
			, additions, historicalTransitions
		}, null, 2) + "\n", draft ? undefined : { flag: "wx" });
	process.stdout.write("Recorded the omitted Perl archive-history hub transition.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
