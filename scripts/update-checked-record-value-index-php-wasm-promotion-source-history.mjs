#!/usr/bin/env node
/**
 * Record the exact source transition that promotes hosted PHP-Wasm
 * value-index evidence without rewriting an earlier ledger.
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
	checkedRecordValueIndexPhpWasmPromotionAddedSourcePaths
	, checkedRecordValueIndexPhpWasmPromotionChangedPaths
	, checkedRecordValueIndexPhpWasmPromotionDraftParent
	, checkedRecordValueIndexPhpWasmPromotionFoundationAddedPaths
	, checkedRecordValueIndexPhpWasmPromotionFoundationModifiedPaths
	, checkedRecordValueIndexPhpWasmPromotionHistoryAddedPaths
	, checkedRecordValueIndexPhpWasmPromotionHistoryPath
	, checkedRecordValueIndexPhpWasmPromotionPredecessor
	, reverseCheckedRecordValueIndexPhpWasmPromotionUpdate
} from "../tests/helpers/checked-record-value-index-php-wasm-promotion-source-history.mjs";
import {
	checkedRecordValueIndexPhpWasmPromotionBaseline
	, checkedRecordValueIndexPhpWasmPromotionReferences
	, promoteCheckedRecordValueIndexPhpWasm
} from "../tests/helpers/checked-record-value-index-php-wasm-promotion.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexPhpWasmPromotionDraftParent
	, "PHP-Wasm value-index promotion history must stay on its exact promotion commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexPhpWasmPromotionPredecessor
	, "PHP-Wasm value-index promotion must keep its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexPhpWasmPromotionDraftParent}:${checkedRecordValueIndexPhpWasmPromotionHistoryPath}`]
, { stdio: "ignore" }).status, 0
, "Never rewrite committed PHP-Wasm value-index promotion history");
const draft = await readFile(checkedRecordValueIndexPhpWasmPromotionHistoryPath, "utf8")
	.then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-php-wasm-promotion-source-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexPhpWasmPromotionPredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexPhpWasmPromotionDraftParent);
}
const typeSurfacePath = "docs/type-surface.v1.json";
await writeFile(typeSurfacePath, JSON.stringify(
	await promoteCheckedRecordValueIndexPhpWasm(
		checkedRecordValueIndexPhpWasmPromotionBaseline()
		, await checkedRecordValueIndexPhpWasmPromotionReferences()
	)
	, null, 2) + "\n");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexPhpWasmPromotionPredecessor
	, checkedRecordValueIndexPhpWasmPromotionDraftParent])
, [...checkedRecordValueIndexPhpWasmPromotionFoundationModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexPhpWasmPromotionPredecessor
	, checkedRecordValueIndexPhpWasmPromotionDraftParent])
, [...checkedRecordValueIndexPhpWasmPromotionFoundationAddedPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexPhpWasmPromotionHistoryAddedPaths])
, [...checkedRecordValueIndexPhpWasmPromotionHistoryAddedPaths].sort());

const sources = new Map();
for(const path of checkedRecordValueIndexPhpWasmPromotionChangedPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexPhpWasmPromotionPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexPhpWasmPromotionAddedSourcePaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexPhpWasmPromotionPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-php-wasm-promotion-history-"
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
	const updates = [];
	for(const path of checkedRecordValueIndexPhpWasmPromotionChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCheckedRecordValueIndexPhpWasmPromotionUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	await writeFile(checkedRecordValueIndexPhpWasmPromotionHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-record-value-index-php-wasm-promotion-source-v1"
		, predecessorCommit: checkedRecordValueIndexPhpWasmPromotionPredecessor
		, draftParentCommit: checkedRecordValueIndexPhpWasmPromotionDraftParent
		, foundation: {
			modifiedPaths: checkedRecordValueIndexPhpWasmPromotionFoundationModifiedPaths
			, addedPaths: checkedRecordValueIndexPhpWasmPromotionFoundationAddedPaths
		}
		, pathsSha256: sha256(JSON.stringify(
			checkedRecordValueIndexPhpWasmPromotionChangedPaths))
		, additions, updates
	}, null, 2) + "\n", draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} PHP-Wasm value-index promotion transitions and ${additions.length} source additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
