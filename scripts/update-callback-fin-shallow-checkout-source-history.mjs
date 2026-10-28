#!/usr/bin/env node
/**
 * Record the shallow callback-Fin checkout and exact pin transition.
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
	callbackFinShallowCheckoutAddedPaths
	, callbackFinShallowCheckoutHistoryPath
	, callbackFinShallowCheckoutImplementation
	, callbackFinShallowCheckoutImplementationPaths
	, callbackFinShallowCheckoutIntegrationPaths
	, callbackFinShallowCheckoutPinPaths
	, callbackFinShallowCheckoutPinRepair
	, callbackFinShallowCheckoutPredecessor
	, reverseCallbackFinShallowCheckoutUpdate
} from "../tests/helpers/callback-fin-shallow-checkout-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackFinShallowCheckoutPinRepair);
assert.equal(git(["rev-parse"
	, `${callbackFinShallowCheckoutImplementation}^`]).trim()
, callbackFinShallowCheckoutPredecessor);
assert.equal(git(["rev-parse", `${callbackFinShallowCheckoutPinRepair}^`]).trim()
	, callbackFinShallowCheckoutImplementation);
assert.deepEqual(names(["diff", "--name-only"
	, callbackFinShallowCheckoutPredecessor
	, callbackFinShallowCheckoutImplementation])
, [...callbackFinShallowCheckoutImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, callbackFinShallowCheckoutImplementation
	, callbackFinShallowCheckoutPinRepair])
, [...callbackFinShallowCheckoutPinPaths]);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...callbackFinShallowCheckoutIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...callbackFinShallowCheckoutAddedPaths])
, [...callbackFinShallowCheckoutAddedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackFinShallowCheckoutHistoryPath]).trim(), "");

const directory = await mkdtemp(join(tmpdir(), "lean-callback-fin-shallow-"));
const lineOffsets = (source, boundaries) => {
	const offsets = new Map(); let line = 0, offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		while(line < boundary)
		{
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1; ++line;
		}
		offsets.set(boundary, offset);
	}
	return offsets;
};
const workingTreeTransition = async (path, previous, current) => {
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
		const oldCount = Number(match[2] ?? 1), newCount = Number(match[4] ?? 1);
		const oldStart = Number(match[1]) - (oldCount ? 1 : 0);
		const newStart = Number(match[3]) - (newCount ? 1 : 0);
		return { oldStart, oldEnd: oldStart + oldCount
			, newStart, newEnd: newStart + newCount };
	});
	const oldOffsets = lineOffsets(previous
		, hunks.flatMap(hunk => [hunk.oldStart, hunk.oldEnd]));
	const newOffsets = lineOffsets(current
		, hunks.flatMap(hunk => [hunk.newStart, hunk.newEnd]));
	const edits = hunks.map(hunk => ({
		start: newOffsets.get(hunk.newStart)
		, previous: previous.slice(oldOffsets.get(hunk.oldStart)
			, oldOffsets.get(hunk.oldEnd))
		, current: current.slice(newOffsets.get(hunk.newStart)
			, newOffsets.get(hunk.newEnd))
	}));
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseCallbackFinShallowCheckoutUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackFinShallowCheckoutImplementationPaths)
		updates.push(await gitSourceHistoryTransition(path
			, callbackFinShallowCheckoutPredecessor
			, callbackFinShallowCheckoutImplementation));
	const pinUpdates = [];
	for(const path of callbackFinShallowCheckoutPinPaths)
		pinUpdates.push(await gitSourceHistoryTransition(path
			, callbackFinShallowCheckoutImplementation
			, callbackFinShallowCheckoutPinRepair));
	const integrationUpdates = [];
	for(const path of callbackFinShallowCheckoutIntegrationPaths)
		integrationUpdates.push(await workingTreeTransition(path
			, git(["show", `${callbackFinShallowCheckoutPinRepair}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackFinShallowCheckoutAddedPaths)
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	await writeFile(callbackFinShallowCheckoutHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-fin-shallow-checkout-source-v1"
		, predecessorCommit: callbackFinShallowCheckoutPredecessor
		, implementationCommit: callbackFinShallowCheckoutImplementation
		, pinRepairCommit: callbackFinShallowCheckoutPinRepair
		, scope: "Replace four unnecessary full-history checkouts in the Python/Ruby/Rust and four-ABI Perl callback acceptance workflows with exact depth-one checkouts. The targeted producers consume only the current commit and current package bytes. Refresh the one live source pin affected by this transition; change no type-surface claim, observation, evidence inventory or runtime contract."
		, livePinRefreshes: 1
		, additions, updates, pinUpdates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} workflow, ${pinUpdates.length} pin and ${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
