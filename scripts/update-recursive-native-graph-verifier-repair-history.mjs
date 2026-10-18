#!/usr/bin/env node
/**
 * Record the exact graph-aware verifier repair for recursive C/C++ packages.
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
	recursiveNativeGraphVerifierRepairAddedPaths
	, recursiveNativeGraphVerifierRepairChangedPaths
	, recursiveNativeGraphVerifierRepairDraftParent
	, recursiveNativeGraphVerifierRepairHistoryPath
	, recursiveNativeGraphVerifierRepairPredecessor
	, reverseRecursiveNativeGraphVerifierRepairUpdate
} from "../tests/helpers/recursive-native-graph-verifier-repair-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, recursiveNativeGraphVerifierRepairDraftParent
	, "Recursive native graph verifier repair must stay on its exact draft parent");
assert.equal(recursiveNativeGraphVerifierRepairPredecessor
	, recursiveNativeGraphVerifierRepairDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, recursiveNativeGraphVerifierRepairDraftParent, "--"
	, recursiveNativeGraphVerifierRepairHistoryPath]).trim(), ""
, "Never rewrite committed recursive native graph verifier evidence");

const draft = await readFile(
	recursiveNativeGraphVerifierRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "recursive-native-graph-verifier-repair-source-v1");
	assert.equal(draft.predecessorCommit
		, recursiveNativeGraphVerifierRepairPredecessor);
	assert.equal(draft.draftParentCommit
		, recursiveNativeGraphVerifierRepairDraftParent);
}

const inventoryPath = "docs/type-surface.v1.json";
const baselineInventory = JSON.parse(git(["show"
	, `${recursiveNativeGraphVerifierRepairPredecessor}:${inventoryPath}`]));
const currentInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
assert.deepEqual(currentInventory, baselineInventory
	, "Graph verifier repair must not rewrite the public support inventory");

assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, recursiveNativeGraphVerifierRepairPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...recursiveNativeGraphVerifierRepairChangedPaths].sort());
const sources = new Map();
for(const path of recursiveNativeGraphVerifierRepairChangedPaths)
{
	const previous = git(["show"
		, `${recursiveNativeGraphVerifierRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of recursiveNativeGraphVerifierRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${recursiveNativeGraphVerifierRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-recursive-native-graph-verifier-repair-"
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
	for(const path of recursiveNativeGraphVerifierRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseRecursiveNativeGraphVerifierRepairUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "recursive-native-graph-verifier-repair-source-v1"
		, predecessorCommit: recursiveNativeGraphVerifierRepairPredecessor
		, draftParentCommit: recursiveNativeGraphVerifierRepairDraftParent
		, pathsSha256: sha256(JSON.stringify(
			recursiveNativeGraphVerifierRepairChangedPaths))
		, pinCount: 0, pinUpdates: [], additions, updates
	}, null, 2) + "\n";
	await writeFile(recursiveNativeGraphVerifierRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} recursive native graph verifier transitions, 0 pin rewrites and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
