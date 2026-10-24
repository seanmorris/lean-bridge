#!/usr/bin/env node
/**
 * Record the explicit PHP-Wasm callback Subtype entry coverage.
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
	phpWasmCallbackSubtypeEntryAddedPaths
	, phpWasmCallbackSubtypeEntryChangedPaths
	, phpWasmCallbackSubtypeEntryHistoryPath
	, phpWasmCallbackSubtypeEntryImplementation
	, phpWasmCallbackSubtypeEntryImplementationAdditions
	, phpWasmCallbackSubtypeEntryIntegrationBase
	, phpWasmCallbackSubtypeEntryIntegrationPaths
	, phpWasmCallbackSubtypeEntryPredecessor
	, reversePhpWasmCallbackSubtypeEntryUpdate
} from "../tests/helpers/php-wasm-callback-subtype-entry-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = phpWasmCallbackSubtypeEntryPredecessor;
const implementation = phpWasmCallbackSubtypeEntryImplementation;
const integrationBase = phpWasmCallbackSubtypeEntryIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "PHP-Wasm callback Subtype entry history requires its exact integration base");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...phpWasmCallbackSubtypeEntryChangedPaths
		, ...phpWasmCallbackSubtypeEntryImplementationAdditions].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmCallbackSubtypeEntryHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...phpWasmCallbackSubtypeEntryIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmCallbackSubtypeEntryAddedPaths])
, [...phpWasmCallbackSubtypeEntryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-callback-subtype-entry-history-"
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
	assert.equal(reversePhpWasmCallbackSubtypeEntryUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of phpWasmCallbackSubtypeEntryChangedPaths)
	{
		const current = git(["show", `${implementation}:${path}`]);
		assert.equal(current, git(["show", `${integrationBase}:${path}`])
			, `Later work changed ${path}; record a composed transition`);
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`]), current));
	}
	const integrationUpdates = [];
	for(const path of phpWasmCallbackSubtypeEntryIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const implementationAdditions = [];
	for(const path of phpWasmCallbackSubtypeEntryImplementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path]).trim(), "", path);
		const current = git(["show", `${implementation}:${path}`]);
		assert.equal(current, git(["show", `${integrationBase}:${path}`]), path);
		assert.equal(current, await readFile(path, "utf8"), path);
		implementationAdditions.push({ path, currentSha256: sha256(current) });
	}
	const additions = [];
	for(const path of phpWasmCallbackSubtypeEntryAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", integrationBase, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmCallbackSubtypeEntryHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-callback-subtype-entry-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, integrationBaseCommit: integrationBase
			, scope: "Add standalone selected-Subtype callback entry probes and nested Subtype-first checked-record refusals on unchanged admitted fixtures, with analyzer-only source/configuration/compiler/model bindings. Expand recurring workflow and independent promotion topology to 30 routes in 27 artifacts, preserving bounded concurrency. Update current documentation references and source-contract pins only; retain all installed observations, support states, historical producer bytes and artifacts. Installed trace order remains subject to hosted validation."
			, implementationAdditions, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
