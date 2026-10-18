#!/usr/bin/env node
/**
 * Record exact hosted recursive checked-record native archive pins.
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
	mutualCheckedRecordNativeArchiveAddedPaths
	, mutualCheckedRecordNativeArchiveChangedPaths
	, mutualCheckedRecordNativeArchiveDraftParent
	, mutualCheckedRecordNativeArchiveHistoryPath
	, mutualCheckedRecordNativeArchivePredecessor
	, reverseMutualCheckedRecordNativeArchiveUpdate
} from "../tests/helpers/mutual-checked-record-native-archive-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, mutualCheckedRecordNativeArchiveDraftParent
	, "Recursive native archive history must stay on its exact draft parent");
assert.equal(mutualCheckedRecordNativeArchivePredecessor
	, mutualCheckedRecordNativeArchiveDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, mutualCheckedRecordNativeArchiveDraftParent, "--"
	, mutualCheckedRecordNativeArchiveHistoryPath]).trim(), ""
, "Never rewrite committed recursive native archive history");

const draft = await readFile(
	mutualCheckedRecordNativeArchiveHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "mutual-checked-record-native-archive-source-v1");
	assert.equal(draft.predecessorCommit
		, mutualCheckedRecordNativeArchivePredecessor);
	assert.equal(draft.draftParentCommit
		, mutualCheckedRecordNativeArchiveDraftParent);
}

const inventoryPath = "docs/type-surface.v1.json";
const baselineInventory = JSON.parse(git(["show"
	, `${mutualCheckedRecordNativeArchivePredecessor}:${inventoryPath}`]));
const currentInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
assert.deepEqual(currentInventory, baselineInventory
	, "Archiving hosted native evidence must not rewrite support inventory");

assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, mutualCheckedRecordNativeArchivePredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...mutualCheckedRecordNativeArchiveChangedPaths].sort());
const sources = new Map();
for(const path of mutualCheckedRecordNativeArchiveChangedPaths)
{
	const previous = git(["show"
		, `${mutualCheckedRecordNativeArchivePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of mutualCheckedRecordNativeArchiveAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${mutualCheckedRecordNativeArchivePredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-recursive-native-archive-history-"
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
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
	for(const path of mutualCheckedRecordNativeArchiveChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseMutualCheckedRecordNativeArchiveUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "mutual-checked-record-native-archive-source-v1"
		, predecessorCommit: mutualCheckedRecordNativeArchivePredecessor
		, draftParentCommit: mutualCheckedRecordNativeArchiveDraftParent
		, pathsSha256: sha256(JSON.stringify(
			mutualCheckedRecordNativeArchiveChangedPaths))
		, pinCount: 1
		, pinUpdates: [{
			path: "tests/helpers/mutual-checked-record-native-evidence.mjs"
			, value: "ec43a05020fd29501dc5f93efbae50ff23c8ab29910569635d399426a8c5bc02"
		}]
		, additions, updates
	}, null, 2) + "\n";
	await writeFile(mutualCheckedRecordNativeArchiveHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} recursive native archive transitions, 1 pin rewrite and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
