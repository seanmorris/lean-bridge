#!/usr/bin/env node
/**
 * Record the WIT SDK rollout and preserve original workflow and archive boundaries.
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
	wasmtimeCapiRolloutAddedPaths
	, wasmtimeCapiRolloutHistoryAddedPaths
	, wasmtimeCapiRolloutImplementationAddedPaths
	, wasmtimeCapiRolloutImplementationPaths
	, wasmtimeCapiRolloutChangedPaths
	, wasmtimeCapiRolloutCommits
	, wasmtimeCapiRolloutHistoryPath
	, wasmtimeCapiRolloutImplementation
	, wasmtimeCapiRolloutIntegrationBase
	, wasmtimeCapiRolloutIntegrationPaths
	, wasmtimeCapiRolloutPredecessor
	, reverseWasmtimeCapiRolloutUpdate
} from "../tests/helpers/wasmtime-capi-ci-rollout-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = wasmtimeCapiRolloutPredecessor;
const implementation = wasmtimeCapiRolloutImplementation;
const integrationBase = wasmtimeCapiRolloutIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Wasmtime C API rollout history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, wasmtimeCapiRolloutCommits);
for(const [index, revision] of wasmtimeCapiRolloutCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : wasmtimeCapiRolloutCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...wasmtimeCapiRolloutImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...wasmtimeCapiRolloutChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...wasmtimeCapiRolloutImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, wasmtimeCapiRolloutHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...wasmtimeCapiRolloutIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...wasmtimeCapiRolloutHistoryAddedPaths])
, [...wasmtimeCapiRolloutHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-wasmtime-capi-ci-rollout-history-"
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
	assert.equal(reverseWasmtimeCapiRolloutUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of wasmtimeCapiRolloutChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of wasmtimeCapiRolloutIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of wasmtimeCapiRolloutAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(wasmtimeCapiRolloutImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(wasmtimeCapiRolloutHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "wasmtime-capi-ci-rollout-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: wasmtimeCapiRolloutCommits
			, integrationBaseCommit: integrationBase
			, scope: "Replace fourteen Wasmtime setup sites in twelve workflows with the identical official 42.0.1 archive and checksum. Confine strict shell flags and cleanup to a subshell, remove eleven unused Nix installer steps and preserve all original routes, budgets, acceptance, artifact and enforcement commands. Make three owned-subtype tool-discovery failures propagate correctly. Retain the six offline installer scenarios, 84 altered/duplicate installer controls, 254 workflow bypass controls and 117 gate outcomes. Refresh exactly 214 live CI/documentation source pins and update two setup descriptions, without modifying runtime code, support observations or older evidence. The rollout has source validation only; require actual installed acceptance, independent original artifact replay and final Core/hosted gates."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
