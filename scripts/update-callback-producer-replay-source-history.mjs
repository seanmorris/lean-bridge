#!/usr/bin/env node
/**
 * Record the exact callback producer replay history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	callbackProducerReplayAddedPaths
	, callbackProducerReplayHistoryPath
	, callbackProducerReplayImplementation
	, callbackProducerReplayImplementationAddedPaths
	, callbackProducerReplayImplementationPaths
	, callbackProducerReplayIntegrationPaths
	, callbackProducerReplayModifiedPaths
	, callbackProducerReplayPredecessor
	, reverseCallbackProducerReplayUpdate
} from "../tests/helpers/callback-producer-replay-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = callbackProducerReplayImplementation;
const predecessor = callbackProducerReplayPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Callback producer replay history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...callbackProducerReplayImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackProducerReplayHistoryPath]).trim(), "");

assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...callbackProducerReplayModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...callbackProducerReplayImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"])
	, [...callbackProducerReplayIntegrationPaths].sort()
	, "Only the recorded hub and test registration may change during integration");

const directory = await mkdtemp(join(
	tmpdir(), "lean-callback-producer-replay-"
));
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
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
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const currentOffsets = [0];
	for(const line of currentLines)
		currentOffsets.push(currentOffsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentOffsets[currentStart]
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.equal(reverseCallbackProducerReplayUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackProducerReplayModifiedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of callbackProducerReplayIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackProducerReplayAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackProducerReplayHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-producer-replay-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Reproduce callback-result models, native/Wasm adapters, public packages, fixtures and semantic-mutant inputs with the unchanged receipt's 44c6789c producer and its complete authenticated 138-file module closure. Keep fresh generators and fresh runtime-inventory validation live, and preserve every original lifetime/install/report assertion. Repair callback inventory tests to request their exact recorded current and previous endpoints, with direct authenticated reversal controls for forged transitions. No original receipt, archive, inventory, execution or support claim changes. Full historical acceptance and its rehashed report mutation suite remain hosted gates."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
