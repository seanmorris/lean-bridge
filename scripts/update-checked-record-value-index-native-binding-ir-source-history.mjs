#!/usr/bin/env node
/**
 * Record the native value-index reviewed/compiler Binding IR repair exactly.
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
	checkedRecordValueIndexNativeBindingIrAddedPaths
	, checkedRecordValueIndexNativeBindingIrChangedPaths
	, checkedRecordValueIndexNativeBindingIrDraftParent
	, checkedRecordValueIndexNativeBindingIrFoundationAddedPaths
	, checkedRecordValueIndexNativeBindingIrFoundationModifiedPaths
	, checkedRecordValueIndexNativeBindingIrHistoryAddedPaths
	, checkedRecordValueIndexNativeBindingIrHistoryPath
	, checkedRecordValueIndexNativeBindingIrPredecessor
	, reverseCheckedRecordValueIndexNativeBindingIrUpdate
} from "../tests/helpers/checked-record-value-index-native-binding-ir-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexNativeBindingIrDraftParent
	, "Native Binding IR history must stay on its exact repair commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexNativeBindingIrPredecessor
	, "Native Binding IR repair must have its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexNativeBindingIrDraftParent}:${checkedRecordValueIndexNativeBindingIrHistoryPath}`]
, { stdio: "ignore" }).status, 0
, "Never rewrite committed native Binding IR history");
const draft = await readFile(
	checkedRecordValueIndexNativeBindingIrHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-native-binding-ir-source-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexNativeBindingIrPredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexNativeBindingIrDraftParent);
}
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexNativeBindingIrPredecessor
	, checkedRecordValueIndexNativeBindingIrDraftParent])
, [...checkedRecordValueIndexNativeBindingIrFoundationModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexNativeBindingIrPredecessor
	, checkedRecordValueIndexNativeBindingIrDraftParent])
, [...checkedRecordValueIndexNativeBindingIrFoundationAddedPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexNativeBindingIrHistoryAddedPaths])
, [...checkedRecordValueIndexNativeBindingIrHistoryAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--"
	, "tests/checked-record-value-index-native.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"])
, ["tests/checked-record-value-index-native.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"]);

const sources = new Map();
for(const path of checkedRecordValueIndexNativeBindingIrChangedPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexNativeBindingIrPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexNativeBindingIrAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexNativeBindingIrPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-native-binding-ir-history-"
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
	for(const path of checkedRecordValueIndexNativeBindingIrChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCheckedRecordValueIndexNativeBindingIrUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	await writeFile(checkedRecordValueIndexNativeBindingIrHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-native-binding-ir-source-v1"
			, predecessorCommit: checkedRecordValueIndexNativeBindingIrPredecessor
			, draftParentCommit: checkedRecordValueIndexNativeBindingIrDraftParent
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexNativeBindingIrChangedPaths))
			, additions, updates
		}, null, 2) + "\n", draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} native Binding IR transitions and ${additions.length} source additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
