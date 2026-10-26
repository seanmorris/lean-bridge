#!/usr/bin/env node
/**
 * Record the exact shared promotion-label source transitions.
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
	ownedCheckedPromotionLabelsAddedPaths
	, ownedCheckedPromotionLabelsHistoryAddedPaths
	, ownedCheckedPromotionLabelsImplementationAddedPaths
	, ownedCheckedPromotionLabelsImplementationPaths
	, ownedCheckedPromotionLabelsChangedPaths
	, ownedCheckedPromotionLabelsCommits
	, ownedCheckedPromotionLabelsHistoryPath
	, ownedCheckedPromotionLabelsImplementation
	, ownedCheckedPromotionLabelsIntegrationBase
	, ownedCheckedPromotionLabelsIntegrationPaths
	, ownedCheckedPromotionLabelsPredecessor
	, reverseOwnedCheckedPromotionLabelsUpdate
} from "../tests/helpers/owned-checked-record-promotion-labels-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = ownedCheckedPromotionLabelsPredecessor;
const implementation = ownedCheckedPromotionLabelsImplementation;
const integrationBase = ownedCheckedPromotionLabelsIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Owned checked-record promotion labels history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, ownedCheckedPromotionLabelsCommits);
for(const [index, revision] of ownedCheckedPromotionLabelsCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : ownedCheckedPromotionLabelsCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedCheckedPromotionLabelsImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...ownedCheckedPromotionLabelsChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...ownedCheckedPromotionLabelsImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedPromotionLabelsHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedCheckedPromotionLabelsIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedCheckedPromotionLabelsHistoryAddedPaths])
, [...ownedCheckedPromotionLabelsHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-checked-record-promotion-labels-history-"
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
	assert.equal(reverseOwnedCheckedPromotionLabelsUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of ownedCheckedPromotionLabelsChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of ownedCheckedPromotionLabelsIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedPromotionLabelsAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(ownedCheckedPromotionLabelsImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(ownedCheckedPromotionLabelsHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-checked-record-promotion-labels-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: ownedCheckedPromotionLabelsCommits
			, integrationBaseCommit: integrationBase
			, scope: "Reuse the bounded closed-lane archive root validator in compact reference construction and all promotion, refresh and rendering boundaries. Admit original labeled captures without renaming them or weakening the complete eleven-lane matrix, forty-four routes, shared native producer, exact index and file identities, or mandatory independent replay. Test all lanes and 64-character labels, reject unsafe labels, path traversal, lane confusion, malformed index suffixes and mixed native producers, and preserve all 170 existing cells and independently accepted Subtype support. Correct the documented selection path and sparse-checkout behavior and link separately accepted owned Subtype coverage. Refresh exactly 44 live hashes; every other inventory byte and all original captures remain unchanged. Projection of the eleven original index manifests is not full matrix replay or new installed execution. Final matrix publication, original-scope audits and hosted/Core/recurring gates remain open."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
