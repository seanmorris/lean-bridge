#!/usr/bin/env node
/**
 * Record the explicit PHP-Wasm entry build-input supplement.
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
	phpWasmEntryBuildInputSupplementAddedPaths
	, phpWasmEntryBuildInputSupplementHistoryAddedPaths
	, phpWasmEntryBuildInputSupplementImplementationAddedPaths
	, phpWasmEntryBuildInputSupplementImplementationPaths
	, phpWasmEntryBuildInputSupplementChangedPaths
	, phpWasmEntryBuildInputSupplementCommits
	, phpWasmEntryBuildInputSupplementHistoryPath
	, phpWasmEntryBuildInputSupplementImplementation
	, phpWasmEntryBuildInputSupplementIntegrationBase
	, phpWasmEntryBuildInputSupplementIntegrationPaths
	, phpWasmEntryBuildInputSupplementPredecessor
	, reversePhpWasmEntryBuildInputSupplementUpdate
} from "../tests/helpers/php-wasm-entry-build-input-supplement-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = phpWasmEntryBuildInputSupplementPredecessor;
const implementation = phpWasmEntryBuildInputSupplementImplementation;
const integrationBase = phpWasmEntryBuildInputSupplementIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "PHP-Wasm entry build-input supplement history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, phpWasmEntryBuildInputSupplementCommits);
for(const [index, revision] of phpWasmEntryBuildInputSupplementCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : phpWasmEntryBuildInputSupplementCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...phpWasmEntryBuildInputSupplementImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...phpWasmEntryBuildInputSupplementChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...phpWasmEntryBuildInputSupplementImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmEntryBuildInputSupplementHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...phpWasmEntryBuildInputSupplementIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmEntryBuildInputSupplementHistoryAddedPaths])
, [...phpWasmEntryBuildInputSupplementHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-entry-build-input-supplement-history-"
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
	assert.equal(reversePhpWasmEntryBuildInputSupplementUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of phpWasmEntryBuildInputSupplementChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of phpWasmEntryBuildInputSupplementIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of phpWasmEntryBuildInputSupplementAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(phpWasmEntryBuildInputSupplementImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(phpWasmEntryBuildInputSupplementHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-entry-build-input-supplement-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: phpWasmEntryBuildInputSupplementCommits
			, integrationBaseCommit: integrationBase
			, scope: "Retain seventeen omitted repository build, license, notice, patch, metadata and preflight inputs for exactly three immutable historical source snapshots. Require those inputs in new captures and before producer execution; authenticate compressed and decoded SHA-256, original Git objects and bounded sizes. Preserve original archives, runtime source and all support observations. Retain two original regression failures, sparse-checkout refusal, seventeen passing checks, three real source ZIP validations, 9,666 authenticated producer files, 620 unchanged reachable modules, exact twelve-pin inventory reversal and a fresh thirty-route original-source replay at the implementation commit. Final-head Core and default-branch recurring activation remain open."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
