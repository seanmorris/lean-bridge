#!/usr/bin/env node
/**
 * Record isolation of recursive graph generators from legacy native reports.
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
	recursiveNativeGraphLoaderIsolationAddedPaths
	, recursiveNativeGraphLoaderIsolationChangedPaths
	, recursiveNativeGraphLoaderIsolationDraftParent
	, recursiveNativeGraphLoaderIsolationHistoryPath
	, recursiveNativeGraphLoaderIsolationPredecessor
	, reverseRecursiveNativeGraphLoaderIsolationUpdate
} from "../tests/helpers/recursive-native-graph-loader-isolation-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, recursiveNativeGraphLoaderIsolationDraftParent
	, "Recursive native graph loader isolation must stay on its exact draft parent");
assert.equal(recursiveNativeGraphLoaderIsolationPredecessor
	, recursiveNativeGraphLoaderIsolationDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, recursiveNativeGraphLoaderIsolationDraftParent, "--"
	, recursiveNativeGraphLoaderIsolationHistoryPath]).trim(), ""
, "Never rewrite committed recursive native graph loader evidence");

const draft = await readFile(
	recursiveNativeGraphLoaderIsolationHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "recursive-native-graph-loader-isolation-source-v1");
	assert.equal(draft.predecessorCommit
		, recursiveNativeGraphLoaderIsolationPredecessor);
	assert.equal(draft.draftParentCommit
		, recursiveNativeGraphLoaderIsolationDraftParent);
}

const inventoryPath = "docs/type-surface.v1.json";
const baselineInventory = JSON.parse(git(["show"
	, `${recursiveNativeGraphLoaderIsolationPredecessor}:${inventoryPath}`]));
const currentInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
assert.deepEqual(currentInventory, baselineInventory
	, "Graph loader isolation must not rewrite the public support inventory");

assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, recursiveNativeGraphLoaderIsolationPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...recursiveNativeGraphLoaderIsolationChangedPaths].sort());
const sources = new Map();
for(const path of recursiveNativeGraphLoaderIsolationChangedPaths)
{
	const previous = git(["show"
		, `${recursiveNativeGraphLoaderIsolationPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of recursiveNativeGraphLoaderIsolationAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${recursiveNativeGraphLoaderIsolationPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-recursive-native-graph-loader-isolation-"
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
	for(const path of recursiveNativeGraphLoaderIsolationChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseRecursiveNativeGraphLoaderIsolationUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "recursive-native-graph-loader-isolation-source-v1"
		, predecessorCommit: recursiveNativeGraphLoaderIsolationPredecessor
		, draftParentCommit: recursiveNativeGraphLoaderIsolationDraftParent
		, pathsSha256: sha256(JSON.stringify(
			recursiveNativeGraphLoaderIsolationChangedPaths))
		, pinCount: 0, pinUpdates: [], additions, updates
	}, null, 2) + "\n";
	await writeFile(recursiveNativeGraphLoaderIsolationHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} recursive native graph loader transitions, 0 pin rewrites and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
