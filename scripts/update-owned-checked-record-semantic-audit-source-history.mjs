#!/usr/bin/env node
/**
 * Record exact source history for the owned checked-record semantic join.
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
	ownedCheckedSemanticAuditAddedPaths
	, ownedCheckedSemanticAuditChangedPaths
	, ownedCheckedSemanticAuditHistoryAddedPaths
	, ownedCheckedSemanticAuditHistoryPath
	, ownedCheckedSemanticAuditImplementation
	, ownedCheckedSemanticAuditImplementationAddedPaths
	, ownedCheckedSemanticAuditImplementationPaths
	, ownedCheckedSemanticAuditIntegrationBase
	, ownedCheckedSemanticAuditIntegrationPaths
	, ownedCheckedSemanticAuditPredecessor
	, reverseOwnedCheckedSemanticAuditUpdate
} from "../tests/helpers/owned-checked-record-semantic-audit-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const predecessor = ownedCheckedSemanticAuditPredecessor;
const implementation = ownedCheckedSemanticAuditImplementation;
const integrationBase = ownedCheckedSemanticAuditIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Owned checked semantic history requires its exact integration base");
assert.equal(git(["show", "-s", "--format=%P", implementation]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedCheckedSemanticAuditImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor
	, implementation]), [...ownedCheckedSemanticAuditChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...ownedCheckedSemanticAuditImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT"
	, predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedSemanticAuditHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...ownedCheckedSemanticAuditIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedCheckedSemanticAuditHistoryAddedPaths])
, [...ownedCheckedSemanticAuditHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-checked-semantic-history-"));
const lineOffsets = (source, boundaries) => {
	const result = new Map();
	let line = 0, offset = 0;
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
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)]
		.map(match => {
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
	assert.equal(reverseOwnedCheckedSemanticAuditUpdate(current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedSemanticAuditChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of ownedCheckedSemanticAuditIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedSemanticAuditAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path]).trim()
			, "", path);
		const bytes = await readFile(path);
		if(ownedCheckedSemanticAuditImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	const value = {
		schemaVersion: 1
		, milestone: "owned-checked-record-semantic-audit-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, integrationBaseCommit: integrationBase
		, scope: "Join 25 exact retained consumer sources to 44 installed hosted routes across eleven lanes, seventeen published profiles and 52 executed host/runtime cells. Require the full mixed copied, owned, borrowed, transferred, callback and returned-closure surface, while proving result-only sources omit all input, transfer, callback and retain operations. Bind every source and report to the selected immutable Git archive and independently reject changed retained bytes. Preserve the separately verified complete package/archive replay and its documented boundary."
		, additions, updates, integrationUpdates
	};
	await writeFile(ownedCheckedSemanticAuditHistoryPath, canonicalJson(value)
		, { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
