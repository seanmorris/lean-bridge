#!/usr/bin/env node
/**
 * Record the installed callback-Fin Ruby and Perl repairs as reversible source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	callbackFinHostRepairAddedPaths
	, callbackFinHostRepairChangedPaths
	, callbackFinHostRepairHistoryPath
	, callbackFinHostRepairImplementation
	, callbackFinHostRepairIntegrationPaths
	, callbackFinHostRepairPredecessor
	, reverseCallbackFinHostRepairUpdate
} from "../tests/helpers/callback-fin-host-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = callbackFinHostRepairPredecessor;
const implementation = callbackFinHostRepairImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Callback Fin host history requires its implementation commit");
assert.equal(git(["show", "-s", "--format=%P", implementation]).trim()
	, predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...callbackFinHostRepairChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackFinHostRepairHistoryPath]).trim(), "");
for(const path of callbackFinHostRepairIntegrationPaths)
	assert.notEqual(git(["diff", "HEAD", "--name-only", "--", path]).trim()
		, "", path);
for(const path of callbackFinHostRepairAddedPaths)
	assert.equal(names(["ls-files", "--others", "--exclude-standard", "--", path]).at(0)
		, path);

const directory = await mkdtemp(join(tmpdir(), "lean-callback-fin-host-history-"));
const lineOffsets = (source, boundaries) => {
	const result = new Map(); let line = 0, offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		assert.ok(Number.isSafeInteger(boundary) && boundary >= 0);
		while(line < boundary)
		{
			assert.ok(offset < source.length, "Diff line exceeds source");
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1; line++;
		}
		result.set(boundary, offset);
	}
	return result;
};
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const hunks = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount };
	});
	const previousOffsets = lineOffsets(previous
		, hunks.flatMap(item => [item.previousStart, item.previousEnd]));
	const currentOffsets = lineOffsets(current
		, hunks.flatMap(item => [item.currentStart, item.currentEnd]));
	const edits = hunks.map(item => ({
		start: currentOffsets.get(item.currentStart)
		, previous: previous.slice(previousOffsets.get(item.previousStart)
			, previousOffsets.get(item.previousEnd))
		, current: current.slice(currentOffsets.get(item.currentStart)
			, currentOffsets.get(item.currentEnd))
	}));
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseCallbackFinHostRepairUpdate(current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackFinHostRepairChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of callbackFinHostRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackFinHostRepairAddedPaths)
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	await writeFile(callbackFinHostRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-fin-host-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Repair the remaining installed callback-Fin host failures without changing the proven Lean algorithm or support claims. Ruby now checks the generated RangeError contract and exact failing paths for scalar, nested and nominal closure inputs. Perl leaves outer callback refinement nodes to the generated callable adapters instead of treating callback handles as structural values, while generated POD records the checked callback paths. Source-only tests reproduce both hosted failures."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation updates, `
		+ `${integrationUpdates.length} integration updates and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
