#!/usr/bin/env node
/**
 * Record recursive checked-record native verifier and archive hardening.
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
	mutualCheckedRecordNativeHardeningAddedPaths
	, mutualCheckedRecordNativeHardeningChangedPaths
	, mutualCheckedRecordNativeHardeningDeletedPaths
	, mutualCheckedRecordNativeHardeningDraftParent
	, mutualCheckedRecordNativeHardeningHistoryPath
	, mutualCheckedRecordNativeHardeningPredecessor
	, reverseMutualCheckedRecordNativeHardeningUpdate
} from "../tests/helpers/mutual-checked-record-native-hardening-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const currentSource = path => readFile(path, "utf8").catch(error => {
	if(error.code === "ENOENT"
		&& mutualCheckedRecordNativeHardeningDeletedPaths.includes(path)) return "";
	throw error;
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, mutualCheckedRecordNativeHardeningDraftParent
	, "Recursive native hardening history must stay on its exact draft parent");
assert.equal(mutualCheckedRecordNativeHardeningPredecessor
	, mutualCheckedRecordNativeHardeningDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, mutualCheckedRecordNativeHardeningDraftParent, "--"
	, mutualCheckedRecordNativeHardeningHistoryPath]).trim(), ""
, "Never rewrite committed recursive native hardening history");
const draft = await readFile(
	mutualCheckedRecordNativeHardeningHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "mutual-checked-record-native-hardening-source-v1");
	assert.equal(draft.predecessorCommit
		, mutualCheckedRecordNativeHardeningPredecessor);
	assert.equal(draft.draftParentCommit
		, mutualCheckedRecordNativeHardeningDraftParent);
}
const changedOnDisk = git(["diff", "--name-only", "--diff-filter=MD"
	, mutualCheckedRecordNativeHardeningPredecessor, "--"])
	.trim().split("\n").filter(Boolean);
assert.deepEqual(changedOnDisk.sort()
	, [...mutualCheckedRecordNativeHardeningChangedPaths].sort());
const sources = new Map();
for(const path of mutualCheckedRecordNativeHardeningChangedPaths)
{
	const previous = git(["show"
		, `${mutualCheckedRecordNativeHardeningPredecessor}:${path}`]);
	const current = await currentSource(path);
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const pinUpdates = [];
const pinCount = 0;
assert.equal(pinCount, 0);
assert.deepEqual(pinUpdates, []);

const additions = [];
for(const path of mutualCheckedRecordNativeHardeningAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${mutualCheckedRecordNativeHardeningPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
const directory = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-native-history-"));
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
	for(const path of mutualCheckedRecordNativeHardeningChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseMutualCheckedRecordNativeHardeningUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "mutual-checked-record-native-hardening-source-v1"
		, predecessorCommit: mutualCheckedRecordNativeHardeningPredecessor
		, draftParentCommit: mutualCheckedRecordNativeHardeningDraftParent
		, pathsSha256: sha256(JSON.stringify(
			mutualCheckedRecordNativeHardeningChangedPaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(mutualCheckedRecordNativeHardeningHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} recursive native hardening transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
