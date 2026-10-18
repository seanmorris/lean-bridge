#!/usr/bin/env node
/**
 * Record the exact fail-closed callback Fin gate repair.
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
	callbackFinGateRepairAddedPaths
	, callbackFinGateRepairChangedPaths
	, callbackFinGateRepairDraftParent
	, callbackFinGateRepairHistoryPath
	, callbackFinGateRepairPredecessor
	, reverseCallbackFinGateRepairUpdate
} from "../tests/helpers/callback-fin-gate-repair-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackFinGateRepairDraftParent
	, "Callback Fin gate repair must stay on its exact draft parent");
assert.equal(callbackFinGateRepairPredecessor
	, callbackFinGateRepairDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, callbackFinGateRepairDraftParent, "--"
	, callbackFinGateRepairHistoryPath]).trim(), ""
, "Never rewrite committed callback Fin gate repair evidence");

const draft = await readFile(
	callbackFinGateRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "callback-fin-gate-repair-source-v1");
	assert.equal(draft.predecessorCommit, callbackFinGateRepairPredecessor);
	assert.equal(draft.draftParentCommit, callbackFinGateRepairDraftParent);
}

const inventoryPath = "docs/type-surface.v1.json";
const baselineInventory = JSON.parse(git(["show"
	, `${callbackFinGateRepairPredecessor}:${inventoryPath}`]));
const currentInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const transitions = new Map();
for(const path of callbackFinGateRepairChangedPaths)
{
	if(path === inventoryPath) continue;
	const previous = git(["show"
		, `${callbackFinGateRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	transitions.set(path, {
		previousSha256: sha256(previous), currentSha256: sha256(current)
	});
}
const expectedInventory = structuredClone(baselineInventory);
const pinCounts = new Map();
for(const entry of expectedInventory.evidence)
	for(const file of entry.files)
	{
		const transition = transitions.get(file.path);
		if(!transition || file.sha256 !== transition.previousSha256) continue;
		file.sha256 = transition.currentSha256;
		pinCounts.set(file.path, (pinCounts.get(file.path) ?? 0) + 1);
	}
if(draft) assert.deepEqual(currentInventory, expectedInventory);
else assert.deepEqual(currentInventory, baselineInventory);
await writeFile(inventoryPath
	, JSON.stringify(expectedInventory, null, 2) + "\n");

assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, callbackFinGateRepairPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...callbackFinGateRepairChangedPaths].sort());
const sources = new Map();
for(const path of callbackFinGateRepairChangedPaths)
{
	const previous = git(["show"
		, `${callbackFinGateRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of callbackFinGateRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${callbackFinGateRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-fin-gate-repair-"
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
	for(const path of callbackFinGateRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCallbackFinGateRepairUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const pinUpdates = [...pinCounts].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, count]) => ({
		path
		, previousSha256: transitions.get(path).previousSha256
		, currentSha256: transitions.get(path).currentSha256
		, count
		}));
	const pinCount = pinUpdates.reduce((total, item) => total + item.count, 0);
	assert.equal(pinCount, 45);
	assert.deepEqual(expectedInventory.evidence.map(item => item.id)
		, baselineInventory.evidence.map(item => item.id));
	assert.deepEqual(expectedInventory.observations, baselineInventory.observations);
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "callback-fin-gate-repair-source-v1"
		, predecessorCommit: callbackFinGateRepairPredecessor
		, draftParentCommit: callbackFinGateRepairDraftParent
		, pathsSha256: sha256(JSON.stringify(
			callbackFinGateRepairChangedPaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(callbackFinGateRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} callback Fin gate transitions, ${pinCount} validated pins and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
