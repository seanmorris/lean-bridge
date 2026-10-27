#!/usr/bin/env node
/**
 * Record the default-branch CI trigger-budget repair.
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
	defaultBranchCiTriggerBudgetHistoryAdditions
	, defaultBranchCiTriggerBudgetHistoryPath
	, defaultBranchCiTriggerBudgetImplementation
	, defaultBranchCiTriggerBudgetImplementationAdditions
	, defaultBranchCiTriggerBudgetIntegrationPaths
	, defaultBranchCiTriggerBudgetPredecessor
	, reverseDefaultBranchCiTriggerBudgetUpdate
} from "../tests/helpers/default-branch-ci-trigger-budget-source-history.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = defaultBranchCiTriggerBudgetPredecessor;
const implementation = defaultBranchCiTriggerBudgetImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "trigger-budget history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
const modifiedPaths = names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation]);
const addedPaths = names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation]);
assert.equal(modifiedPaths.length, 233);
assert.equal(modifiedPaths.filter(path =>
	path.startsWith(".github/workflows/")).length, 112);
assert.equal(modifiedPaths.filter(path => path.startsWith("tests/")).length
	, 121);
assert.deepEqual(addedPaths
	, [...defaultBranchCiTriggerBudgetImplementationAdditions]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...modifiedPaths, ...addedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, defaultBranchCiTriggerBudgetHistoryPath]).trim(), "");

const updates = [];
for(const path of modifiedPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));

const transitions = new Map(updates.map(update => [update.path, update]));
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurfaceSource = await readFile(typeSurfacePath, "utf8");
const pointerCounts = new Map();
const nextTypeSurface = typeSurfaceSource.replace(
	/("path": "([^"]+)",\n\s*"sha256": ")([0-9a-f]{64})(")/gu
	, (match, prefix, path, digest, suffix) => {
		const transition = transitions.get(path);
		if(transition === undefined || digest !== transition.previousSha256)
			return match;
		pointerCounts.set(path, (pointerCounts.get(path) ?? 0) + 1);
		return `${prefix}${transition.currentSha256}${suffix}`;
	}
);
assert.notEqual(nextTypeSurface, typeSurfaceSource);
await writeFile(typeSurfacePath, nextTypeSurface);
const pointerUpdates = [...pointerCounts].map(([path, citations]) => ({
	path
	, previous: transitions.get(path).previousSha256
	, current: transitions.get(path).currentSha256
	, citations
})).sort((left, right) => left.path.localeCompare(right.path));
assert.ok(pointerUpdates.length > 0);
assert.ok(pointerUpdates.every(update => update.citations > 0));

assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...defaultBranchCiTriggerBudgetIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...defaultBranchCiTriggerBudgetHistoryAdditions])
, [...defaultBranchCiTriggerBudgetHistoryAdditions].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-ci-trigger-budget-"));
const lineOffsets = (source, boundaries) => {
	const offsets = new Map();
	let line = 0;
	let offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		while(line < boundary)
		{
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			++line;
		}
		offsets.set(boundary, offset);
	}
	return offsets;
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
		return { previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount };
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
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseDefaultBranchCiTriggerBudgetUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const integrationUpdates = [];
	for(const path of defaultBranchCiTriggerBudgetIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of defaultBranchCiTriggerBudgetImplementationAdditions)
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	const historyAdditions = [];
	for(const path of defaultBranchCiTriggerBudgetHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		historyAdditions.push({ path
			, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(defaultBranchCiTriggerBudgetHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "default-branch-ci-trigger-budget-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Keep the six established CI entry points and two path-scoped aggregate audits automatic while retaining 112 heavyweight acceptance producers as explicit dispatch, reusable, scheduled or release-triggered workflows."
		, workflowCount: 122
		, modifiedWorkflowCount: 112
		, removedAutomaticTriggerCount: 224
		, approvedAutomaticWorkflowCount: 7
		, pathScopedAutomaticWorkflowCount: 2
		, pointerUpdates, additions, historyAdditions, updates
		, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions; refreshed `
		+ `${pointerUpdates.length} unique type-surface paths.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
