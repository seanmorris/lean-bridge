#!/usr/bin/env node
/**
 * Record omitted matrix/browser history-hub and Rust expectation edges.
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
	checkedRecordValueIndexMatrixHistoryGapAddedPaths
	, checkedRecordValueIndexMatrixHistoryGapDraftParent
	, checkedRecordValueIndexMatrixHistoryGapHistoricalPaths
	, checkedRecordValueIndexMatrixHistoryGapPath
	, checkedRecordValueIndexMatrixHistoryGapPredecessor
	, reverseCheckedRecordValueIndexMatrixHistoricalGapUpdate
	, reverseCheckedRecordValueIndexMatrixHistoryGapUpdate
} from "../tests/helpers/checked-record-value-index-matrix-history-gap-source-history.mjs";

const hubPath = "tests/helpers/fin-refinement-source-history.mjs";
const typeTestPath = "tests/type-surface.test.mjs";
const historicalEdges = Object.freeze([
	[hubPath, "c4f81e11ae8816b2b5239a01cd2695ffd641485b"
		, "13eaf45d4b1909b9cecf5278c050bd67b51ebbe7"]
	, [hubPath, "8681daba4d4dc83e527bf2091fa8c4d2cd9361d0"
		, "d8f87b3743790d99b1238cb0b78a4cfc8d9b8bf1"]
	, [hubPath, "19a3e5455228526f5bb4e7089239d59f03f5e8f2"
		, "6feb79010a9d96ec7462123f02295782d42693db"]
	, [hubPath, "b684ba1382046bf970fbc8987c7f6709e6e5096a"
		, "fc1a0c8bae218192482acf0a82c88b6e5b86a974"]
	, [hubPath, "d7531e61b1d3ed9ae2eb569d2d3f20ae33eb62df"
		, "0da7d1d6054a87de82082b4d2afad7bf5e30048e"]
	, [hubPath, "456713bcfc24997101a99fefb6e60bd1f9e57ab0"
		, "2bcf998d058a38f44fb3ec104a339966b1e329f1"]
	, [hubPath, "0af79d1441b0e8fb8b1e483a6c08811eaf0a2c21"
		, "102da2b7ec1382625bc2a7f35a66c8d8515e17a6"]
	, [hubPath, "3bf9c4dc8437f48e86105e5d6f948197afe07e11"
		, "12646a8ad32b98d6825310677c809f1a7b50f84a"]
	, [typeTestPath, "42c40d8d54895be99bfcd2ee6856357919f55113"
		, "d7531e61b1d3ed9ae2eb569d2d3f20ae33eb62df"]
]);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexMatrixHistoryGapDraftParent
	, "Value-index matrix history gap must stay on its exact draft parent");
assert.equal(checkedRecordValueIndexMatrixHistoryGapPredecessor
	, checkedRecordValueIndexMatrixHistoryGapDraftParent);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexMatrixHistoryGapDraftParent}:${checkedRecordValueIndexMatrixHistoryGapPath}`]
, { stdio: "ignore" }).status, 0
, "Never rewrite committed value-index matrix history-gap evidence");
assert.deepEqual([...new Set([
	...names(["ls-files", "--others", "--exclude-standard", "--"
		, ...checkedRecordValueIndexMatrixHistoryGapAddedPaths])
	, ...names(["diff", "--cached", "--name-only", "--diff-filter=A", "--"
		, ...checkedRecordValueIndexMatrixHistoryGapAddedPaths])
])].sort(), [...checkedRecordValueIndexMatrixHistoryGapAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"
	, "tests/checked-record-value-index-matrix.test.mjs", hubPath]), [
	"tests/checked-record-value-index-matrix.test.mjs", hubPath]
);

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-matrix-history-gap-"
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
			, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
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
	const previous = git(["show"
		, `${checkedRecordValueIndexMatrixHistoryGapPredecessor}:${hubPath}`]);
	const current = await readFile(hubPath, "utf8");
	const update = {
		path: hubPath, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits: await edits(previous, current)
	};
	assert.equal(reverseCheckedRecordValueIndexMatrixHistoryGapUpdate(
		current, update), previous);
	const historicalTransitions = [];
	for(const [path, previousCommit, currentCommit] of historicalEdges)
	{
		assert.ok(checkedRecordValueIndexMatrixHistoryGapHistoricalPaths.includes(path));
		const earlier = git(["show", `${previousCommit}:${path}`]);
		const later = git(["show", `${currentCommit}:${path}`]);
		const transition = {
			path, previousCommit, currentCommit
			, previousSha256: sha256(earlier), currentSha256: sha256(later)
			, edits: await edits(earlier, later)
		};
		assert.equal(reverseCheckedRecordValueIndexMatrixHistoricalGapUpdate(
			later, transition), earlier);
		historicalTransitions.push(transition);
	}
	const additions = [];
	for(const path of checkedRecordValueIndexMatrixHistoryGapAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexMatrixHistoryGapPredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(checkedRecordValueIndexMatrixHistoryGapPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-matrix-history-gap-source-v1"
			, predecessorCommit: checkedRecordValueIndexMatrixHistoryGapPredecessor
			, draftParentCommit: checkedRecordValueIndexMatrixHistoryGapDraftParent
			, additions, updates: [update], historicalTransitions
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded one live value-index history-hub transition, ${historicalTransitions.length} omitted edges, and ${additions.length} source additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
