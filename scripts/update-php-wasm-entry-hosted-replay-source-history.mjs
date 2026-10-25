#!/usr/bin/env node
/**
 * Record the explicit PHP-Wasm entry hosted replay.
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
	phpWasmEntryHostedReplayAddedPaths
	, phpWasmEntryHostedReplayHistoryAddedPaths
	, phpWasmEntryHostedReplayImplementationAddedPaths
	, phpWasmEntryHostedReplayImplementationPaths
	, phpWasmEntryHostedReplayChangedPaths
	, phpWasmEntryHostedReplayCommits
	, phpWasmEntryHostedReplayHistoryPath
	, phpWasmEntryHostedReplayImplementation
	, phpWasmEntryHostedReplayIntegrationBase
	, phpWasmEntryHostedReplayIntegrationPaths
	, phpWasmEntryHostedReplayPredecessor
	, reversePhpWasmEntryHostedReplayUpdate
} from "../tests/helpers/php-wasm-entry-hosted-replay-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = phpWasmEntryHostedReplayPredecessor;
const implementation = phpWasmEntryHostedReplayImplementation;
const integrationBase = phpWasmEntryHostedReplayIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "PHP-Wasm entry hosted replay history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, phpWasmEntryHostedReplayCommits);
for(const [index, revision] of phpWasmEntryHostedReplayCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : phpWasmEntryHostedReplayCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...phpWasmEntryHostedReplayImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...phpWasmEntryHostedReplayChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...phpWasmEntryHostedReplayImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmEntryHostedReplayHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...phpWasmEntryHostedReplayIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmEntryHostedReplayHistoryAddedPaths])
, [...phpWasmEntryHostedReplayHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-entry-hosted-replay-history-"
));
// Retain only requested hunk boundaries, not millions of per-line strings.
const lineOffsets = (source, boundaries) => {
	const result = new Map();
	let line = 0;
	let offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		assert.ok(Number.isSafeInteger(boundary) && boundary >= 0);
		while(line < boundary)
		{
			assert.ok(offset < source.length, "Diff line exceeds source");
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			line++;
		}
		result.set(boundary, offset);
	}
	return result;
};
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
	const hunks = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount
		};
	});
	const previousOffsets = lineOffsets(previous, hunks.flatMap(hunk =>
		[hunk.previousStart, hunk.previousEnd]));
	const currentOffsets = lineOffsets(current, hunks.flatMap(hunk =>
		[hunk.currentStart, hunk.currentEnd]));
	const edits = hunks.map(hunk => ({
		start: currentOffsets.get(hunk.currentStart)
		, previous: previous.slice(previousOffsets.get(hunk.previousStart)
			, previousOffsets.get(hunk.previousEnd))
		, current: current.slice(currentOffsets.get(hunk.currentStart)
			, currentOffsets.get(hunk.currentEnd))
	}));
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reversePhpWasmEntryHostedReplayUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of phpWasmEntryHostedReplayChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of phpWasmEntryHostedReplayIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of phpWasmEntryHostedReplayAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(phpWasmEntryHostedReplayImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(phpWasmEntryHostedReplayHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-entry-hosted-replay-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: phpWasmEntryHostedReplayCommits
			, integrationBaseCommit: integrationBase
			, scope: "Bind original PHP-Wasm producer replay to exact Git source bytes: retain src/tests/scripts/config/schema/workflows, manifests, toolchain metadata and the consumer-support contract including non-module assets. Stream original Git blobs into a closed SHA256 manifest; write reproducible source ZIPs and independently verify membership and content. Reject tracked symlinks, hidden assume-unchanged edits, ignored untracked source files, wrong revisions, forged manifests, substituted or omitted ZIP members and existing or symlinked destinations. Invoke the original thirty-route CLI only in its clean Node 22 producer checkout, without injected checkers or saved-success shortcuts, and recheck source bytes after execution. Seven focused controls are registered. Actual original-producer source snapshot independently checked 9,647 files / 66,497,862 bytes. complete matrix acceptance remains separate required work under VO #2061/#1828, as do original artifact retention, diagnostic-only partial retention, committed byte audit, support/docs promotion and final gates. No existing workflow, inventory, record verifier or archived evidence changes."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
