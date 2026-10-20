#!/usr/bin/env node
/**
 * Record the exact source transition that promotes hosted Rust value-index
 * evidence without rewriting an earlier ledger.
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
	checkedRecordValueIndexRustPromotionAddedSourcePaths
	, checkedRecordValueIndexRustPromotionChangedPaths
	, checkedRecordValueIndexRustPromotionDraftParent
	, checkedRecordValueIndexRustPromotionFoundationAddedPaths
	, checkedRecordValueIndexRustPromotionFoundationModifiedPaths
	, checkedRecordValueIndexRustPromotionHistoryAddedPaths
	, checkedRecordValueIndexRustPromotionHistoryPath
	, checkedRecordValueIndexRustPromotionPredecessor
	, reverseCheckedRecordValueIndexRustPromotionUpdate
} from "../tests/helpers/checked-record-value-index-rust-promotion-source-history.mjs";
import {
	checkedRecordValueIndexRustPromotionBaseline
	, checkedRecordValueIndexRustPromotionReferences
	, promoteCheckedRecordValueIndexRust
} from "../tests/helpers/checked-record-value-index-rust-promotion.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexRustPromotionDraftParent
	, "Rust value-index promotion history must stay on its exact promotion commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexRustPromotionPredecessor
	, "Rust value-index promotion must keep its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexRustPromotionDraftParent}:${checkedRecordValueIndexRustPromotionHistoryPath}`]
, { stdio: "ignore" }).status, 0
, "Never rewrite committed Rust value-index promotion history");
const draft = await readFile(
	checkedRecordValueIndexRustPromotionHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-rust-promotion-source-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexRustPromotionPredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexRustPromotionDraftParent);
}
await writeFile("docs/type-surface.v1.json", JSON.stringify(
	await promoteCheckedRecordValueIndexRust(
		checkedRecordValueIndexRustPromotionBaseline()
		, await checkedRecordValueIndexRustPromotionReferences()
	), null, 2) + "\n");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexRustPromotionPredecessor
	, checkedRecordValueIndexRustPromotionDraftParent])
, [...checkedRecordValueIndexRustPromotionFoundationModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexRustPromotionPredecessor
	, checkedRecordValueIndexRustPromotionDraftParent])
, [...checkedRecordValueIndexRustPromotionFoundationAddedPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexRustPromotionHistoryAddedPaths])
, [...checkedRecordValueIndexRustPromotionHistoryAddedPaths].sort());

const sources = new Map();
for(const path of checkedRecordValueIndexRustPromotionChangedPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexRustPromotionPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexRustPromotionAddedSourcePaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexRustPromotionPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-rust-promotion-history-"));
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
	const updates = [];
	for(const path of checkedRecordValueIndexRustPromotionChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCheckedRecordValueIndexRustPromotionUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	await writeFile(checkedRecordValueIndexRustPromotionHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-rust-promotion-source-v1"
			, predecessorCommit: checkedRecordValueIndexRustPromotionPredecessor
			, draftParentCommit: checkedRecordValueIndexRustPromotionDraftParent
			, foundation: {
				modifiedPaths: checkedRecordValueIndexRustPromotionFoundationModifiedPaths
				, addedPaths: checkedRecordValueIndexRustPromotionFoundationAddedPaths
			}
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexRustPromotionChangedPaths))
			, additions, updates
		}, null, 2) + "\n", draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} Rust value-index promotion transitions and ${additions.length} source additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
