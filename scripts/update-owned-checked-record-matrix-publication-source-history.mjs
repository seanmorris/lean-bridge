#!/usr/bin/env node
/**
 * Record the explicit Owned checked-record matrix publication.
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
	ownedCheckedRecordMatrixPublicationAddedPaths
	, ownedCheckedRecordMatrixPublicationHistoryAddedPaths
	, ownedCheckedRecordMatrixPublicationImplementationAddedPaths
	, ownedCheckedRecordMatrixPublicationImplementationPaths
	, ownedCheckedRecordMatrixPublicationChangedPaths
	, ownedCheckedRecordMatrixPublicationCommits
	, ownedCheckedRecordMatrixPublicationHistoryPath
	, ownedCheckedRecordMatrixPublicationImplementation
	, ownedCheckedRecordMatrixPublicationIntegrationBase
	, ownedCheckedRecordMatrixPublicationIntegrationPaths
	, ownedCheckedRecordMatrixPublicationPredecessor
	, reverseOwnedCheckedRecordMatrixPublicationUpdate
} from "../tests/helpers/owned-checked-record-matrix-publication-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = ownedCheckedRecordMatrixPublicationPredecessor;
const implementation = ownedCheckedRecordMatrixPublicationImplementation;
const integrationBase = ownedCheckedRecordMatrixPublicationIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Owned checked-record matrix publication history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, ownedCheckedRecordMatrixPublicationCommits);
for(const [index, revision] of ownedCheckedRecordMatrixPublicationCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : ownedCheckedRecordMatrixPublicationCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedCheckedRecordMatrixPublicationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...ownedCheckedRecordMatrixPublicationChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...ownedCheckedRecordMatrixPublicationImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedRecordMatrixPublicationHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedCheckedRecordMatrixPublicationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedCheckedRecordMatrixPublicationHistoryAddedPaths])
, [...ownedCheckedRecordMatrixPublicationHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-checked-record-matrix-publication-history-"
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
	assert.equal(reverseOwnedCheckedRecordMatrixPublicationUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of ownedCheckedRecordMatrixPublicationChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of ownedCheckedRecordMatrixPublicationIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedRecordMatrixPublicationAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(ownedCheckedRecordMatrixPublicationImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(ownedCheckedRecordMatrixPublicationHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-checked-record-matrix-publication-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: ownedCheckedRecordMatrixPublicationCommits
			, integrationBaseCommit: integrationBase
			, scope: "Apply the complete eleven-archive owned checked-record promotion after independent serial Git-byte/API/ZIP/package/source replay of 7205 retained files and 44 routes. Add eleven compact authenticated references, refine exactly 114 observations covering 170 existing cells across seventeen consumer profiles, both author routes and five positions, and update fourteen manual guides plus generated references. Limit support to the exercised acyclic Booking/Window and Ticket/Claim full and standalone result-only forms; no Grant, nested owned Subtypes, arbitrary containers, recursive owned graphs, retained/async callbacks or performance claims. Add mandatory current-inventory, scope-refusal and documentation-coherence tests. Refresh exactly 81 documentation source hashes, with a verified inverse matching the promoter's staged inventory. Authenticate every full committed endpoint through bounded streams; preserve all original archive bytes and earlier histories. Final-revision Core, required hosted gates and the remaining original #1220 obligations remain separate."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
