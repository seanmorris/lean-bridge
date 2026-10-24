#!/usr/bin/env node
/**
 * Record the exact transfer/borrow producer replay history.
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
	transferBorrowProducerReplayAddedPaths
	, transferBorrowProducerReplayHistoryPath
	, transferBorrowProducerReplayImplementation
	, transferBorrowProducerReplayImplementationAddedPaths
	, transferBorrowProducerReplayImplementationPaths
	, transferBorrowProducerReplayIntegrationPaths
	, transferBorrowProducerReplayModifiedPaths
	, transferBorrowProducerReplayPredecessor
	, reverseTransferBorrowProducerReplayUpdate
} from "../tests/helpers/transfer-borrow-producer-replay-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = transferBorrowProducerReplayImplementation;
const predecessor = transferBorrowProducerReplayPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Transfer/borrow producer replay history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...transferBorrowProducerReplayImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, transferBorrowProducerReplayHistoryPath]).trim(), "");

assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...transferBorrowProducerReplayModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...transferBorrowProducerReplayImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"])
	, [...transferBorrowProducerReplayIntegrationPaths].sort()
	, "Only the recorded hub and test registration may change during integration");

const directory = await mkdtemp(join(
	tmpdir(), "lean-transfer-borrow-producer-replay-"
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
	assert.equal(reverseTransferBorrowProducerReplayUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of transferBorrowProducerReplayModifiedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of transferBorrowProducerReplayIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of transferBorrowProducerReplayAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(transferBorrowProducerReplayHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "transfer-borrow-producer-replay-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Reproduce C++ transfer (5384a754), .NET transfer (7dd8a21a) and WIT borrow (1e6f7f5f) execution receipts with their exact producer modules and source-bound closures of 69, 78 and 67 files. The C++ closure includes one explicit producer-Git-bound Boost payload omitted from its unchanged original source list. Authenticate all three deferred WIT probe inputs and replay installed CLI files from the same producer with recorded hashes and lengths, including files absent from sparse checkouts. Preserve lifetime, installation, mutation, documentation and enabled-gate assertions. Original receipt bytes, native implementations, type inventory and support claims are unchanged. Full history/inventory replay and remaining Core coverage stay hosted gates."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
