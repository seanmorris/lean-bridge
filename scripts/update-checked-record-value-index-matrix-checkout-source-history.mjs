#!/usr/bin/env node
/**
 * Record the exact hosted-checkout correction for the value-index matrix.
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
	checkedRecordValueIndexMatrixCheckoutChangedPaths
	, checkedRecordValueIndexMatrixCheckoutDraftParent
	, checkedRecordValueIndexMatrixCheckoutFoundationAddedPaths
	, checkedRecordValueIndexMatrixCheckoutFoundationModifiedPaths
	, checkedRecordValueIndexMatrixCheckoutHistoryAddedPaths
	, checkedRecordValueIndexMatrixCheckoutHistoryPath
	, checkedRecordValueIndexMatrixCheckoutPredecessor
	, reverseCheckedRecordValueIndexMatrixCheckoutUpdate
} from "../tests/helpers/checked-record-value-index-matrix-checkout-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexMatrixCheckoutDraftParent
	, "Value-index matrix checkout history must stay on its exact repair commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexMatrixCheckoutPredecessor
	, "Value-index matrix checkout repair must have its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexMatrixCheckoutDraftParent}:${checkedRecordValueIndexMatrixCheckoutHistoryPath}`]
, { stdio: "ignore" }).status, 0
, "Never rewrite committed value-index matrix checkout history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexMatrixCheckoutPredecessor
	, checkedRecordValueIndexMatrixCheckoutDraftParent])
, [...checkedRecordValueIndexMatrixCheckoutFoundationModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexMatrixCheckoutPredecessor
	, checkedRecordValueIndexMatrixCheckoutDraftParent])
, [...checkedRecordValueIndexMatrixCheckoutFoundationAddedPaths].sort());
assert.deepEqual([...new Set([
	...names(["ls-files", "--others", "--exclude-standard", "--"
		, ...checkedRecordValueIndexMatrixCheckoutHistoryAddedPaths])
	, ...names(["diff", "--cached", "--name-only", "--diff-filter=A", "--"
		, ...checkedRecordValueIndexMatrixCheckoutHistoryAddedPaths])
])].sort(), [...checkedRecordValueIndexMatrixCheckoutHistoryAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"
	, "tests/checked-record-value-index-matrix.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"]), [
	"tests/checked-record-value-index-matrix.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"]
);

const sources = new Map();
for(const path of checkedRecordValueIndexMatrixCheckoutChangedPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexMatrixCheckoutPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexMatrixCheckoutHistoryAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexMatrixCheckoutPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-matrix-checkout-history-"
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
	const updates = [];
	for(const path of checkedRecordValueIndexMatrixCheckoutChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCheckedRecordValueIndexMatrixCheckoutUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	await writeFile(checkedRecordValueIndexMatrixCheckoutHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-matrix-checkout-source-v1"
			, predecessorCommit: checkedRecordValueIndexMatrixCheckoutPredecessor
			, draftParentCommit: checkedRecordValueIndexMatrixCheckoutDraftParent
			, foundation: {
				modifiedPaths: checkedRecordValueIndexMatrixCheckoutFoundationModifiedPaths
				, addedPaths: checkedRecordValueIndexMatrixCheckoutFoundationAddedPaths
			}
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexMatrixCheckoutChangedPaths))
			, additions, updates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} value-index matrix checkout transitions and ${additions.length} source additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
