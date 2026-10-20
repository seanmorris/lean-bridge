#!/usr/bin/env node
/**
 * Record the exact source transition that promotes hosted value-index evidence.
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
	checkedRecordValueIndexBrowserPromotionAddedSourcePaths
	, checkedRecordValueIndexBrowserPromotionChangedPaths
	, checkedRecordValueIndexBrowserPromotionDraftParent
	, checkedRecordValueIndexBrowserPromotionFoundationAddedPaths
	, checkedRecordValueIndexBrowserPromotionFoundationModifiedPaths
	, checkedRecordValueIndexBrowserPromotionHistoryAddedPaths
	, checkedRecordValueIndexBrowserPromotionHistoryPath
	, checkedRecordValueIndexBrowserPromotionPredecessor
	, reverseCheckedRecordValueIndexBrowserPromotionUpdate
} from "../tests/helpers/checked-record-value-index-browser-promotion-source-history.mjs";
import {
	checkedRecordValueIndexBrowserPromotionBaseline
	, checkedRecordValueIndexBrowserPromotionReferences
	, promoteCheckedRecordValueIndexBrowsers
} from "../tests/helpers/checked-record-value-index-browser-promotion.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = args => git(args).trim()
	.split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexBrowserPromotionDraftParent
	, "Value-index browser promotion history must stay on its exact promotion commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexBrowserPromotionPredecessor
	, "Value-index browser promotion must have its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexBrowserPromotionDraftParent}:${checkedRecordValueIndexBrowserPromotionHistoryPath}`]
, { stdio: "ignore" }).status, 0
, "Never rewrite committed value-index browser promotion history");
const draft = await readFile(
	checkedRecordValueIndexBrowserPromotionHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-browser-promotion-source-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexBrowserPromotionPredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexBrowserPromotionDraftParent);
}
const typeSurfacePath = "docs/type-surface.v1.json";
await writeFile(typeSurfacePath, JSON.stringify(
	await promoteCheckedRecordValueIndexBrowsers(
		checkedRecordValueIndexBrowserPromotionBaseline()
		, await checkedRecordValueIndexBrowserPromotionReferences()
	)
	, null, 2) + "\n");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexBrowserPromotionPredecessor
	, checkedRecordValueIndexBrowserPromotionDraftParent])
, [...checkedRecordValueIndexBrowserPromotionFoundationModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexBrowserPromotionPredecessor
	, checkedRecordValueIndexBrowserPromotionDraftParent])
, [...checkedRecordValueIndexBrowserPromotionFoundationAddedPaths].sort());
assert.deepEqual([...new Set([
	...names(["ls-files", "--others", "--exclude-standard", "--"
		, ...checkedRecordValueIndexBrowserPromotionHistoryAddedPaths])
	, ...names(["diff", "--cached", "--name-only", "--diff-filter=A", "--"
		, ...checkedRecordValueIndexBrowserPromotionHistoryAddedPaths])
])].sort()
, [...checkedRecordValueIndexBrowserPromotionHistoryAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"
	, "tests/checked-record-value-index-browser.test.mjs"
	, typeSurfacePath])
, ["tests/checked-record-value-index-browser.test.mjs"]);

const sources = new Map();
for(const path of checkedRecordValueIndexBrowserPromotionChangedPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexBrowserPromotionPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexBrowserPromotionAddedSourcePaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexBrowserPromotionPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-browser-promotion-history-"
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
	for(const path of checkedRecordValueIndexBrowserPromotionChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCheckedRecordValueIndexBrowserPromotionUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-record-value-index-browser-promotion-source-v1"
		, predecessorCommit: checkedRecordValueIndexBrowserPromotionPredecessor
		, draftParentCommit: checkedRecordValueIndexBrowserPromotionDraftParent
		, foundation: {
			modifiedPaths: checkedRecordValueIndexBrowserPromotionFoundationModifiedPaths
			, addedPaths: checkedRecordValueIndexBrowserPromotionFoundationAddedPaths
		}
		, pathsSha256: sha256(JSON.stringify(
			checkedRecordValueIndexBrowserPromotionChangedPaths))
		, additions, updates
	}, null, 2) + "\n";
	await writeFile(checkedRecordValueIndexBrowserPromotionHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} value-index browser promotion transitions and ${additions.length} source additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
