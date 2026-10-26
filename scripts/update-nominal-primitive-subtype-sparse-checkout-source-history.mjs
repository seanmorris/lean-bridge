#!/usr/bin/env node
/**
 * Record the primitive-base acceptance sparse-checkout source transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	nominalPrimitiveSubtypeSparseCheckoutAddedPaths
	, nominalPrimitiveSubtypeSparseCheckoutHistoryPath
	, nominalPrimitiveSubtypeSparseCheckoutImplementation
	, nominalPrimitiveSubtypeSparseCheckoutImplementationAdditions
	, nominalPrimitiveSubtypeSparseCheckoutImplementationPaths
	, nominalPrimitiveSubtypeSparseCheckoutIntegrationPaths
	, nominalPrimitiveSubtypeSparseCheckoutModifiedPaths
	, nominalPrimitiveSubtypeSparseCheckoutPredecessor
	, reverseNominalPrimitiveSubtypeSparseCheckoutUpdate
} from "../tests/helpers/nominal-primitive-subtype-sparse-checkout-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const gitBytes = arguments_ => execFileSync("git", arguments_
	, { maxBuffer: 256 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = nominalPrimitiveSubtypeSparseCheckoutPredecessor;
const implementation = nominalPrimitiveSubtypeSparseCheckoutImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Primitive Subtype sparse history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...nominalPrimitiveSubtypeSparseCheckoutImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...nominalPrimitiveSubtypeSparseCheckoutModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...nominalPrimitiveSubtypeSparseCheckoutImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${nominalPrimitiveSubtypeSparseCheckoutHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...nominalPrimitiveSubtypeSparseCheckoutIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...nominalPrimitiveSubtypeSparseCheckoutAddedPaths])
, [...nominalPrimitiveSubtypeSparseCheckoutAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-primitive-subtype-sparse-history-"
));
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
	assert.equal(reverseNominalPrimitiveSubtypeSparseCheckoutUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of nominalPrimitiveSubtypeSparseCheckoutModifiedPaths)
		updates.push(await gitSourceHistoryTransition(
			path, predecessor, implementation));
	const implementationAdditions = [];
	for(const path of nominalPrimitiveSubtypeSparseCheckoutImplementationAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${predecessor}:${path}`], { stdio: "ignore" }).status, 0, path);
		implementationAdditions.push({
			path
			, currentSha256: sha256(gitBytes([
				"show", `${implementation}:${path}`
			]))
		});
	}
	const integrationUpdates = [];
	for(const path of nominalPrimitiveSubtypeSparseCheckoutIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of nominalPrimitiveSubtypeSparseCheckoutAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(nominalPrimitiveSubtypeSparseCheckoutHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "nominal-primitive-subtype-sparse-checkout-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Retain complete producer history while reducing each of the thirteen primitive-base nominal Subtype acceptance worktrees from 44.5 GB to 464 MB. Materialize every live source root, both current documentation manifests and exactly the two immutable evidence archives read by the cohort. Preserve all acceptance commands, runtime budgets, artifacts, support claims and original evidence bytes."
			, implementationAdditions, updates, additions, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation updates, `
		+ `${implementationAdditions.length} implementation additions and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
