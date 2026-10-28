#!/usr/bin/env node
/**
 * Record the authenticated WIT/lint two-parent join and workflow-pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	gitSourceHistoryTransition
} from "../tests/helpers/source-history-stream.mjs";
import {
	proofErasureWitLintJoinAddedPaths
	, proofErasureWitLintJoinChangedPaths
	, proofErasureWitLintJoinCommonAncestor
	, proofErasureWitLintJoinHistoryPath
	, proofErasureWitLintJoinImplementation
	, proofErasureWitLintJoinIntegrationPaths
	, proofErasureWitLintJoinLeftParent
	, proofErasureWitLintJoinMerge
	, proofErasureWitLintJoinPinCount
	, proofErasureWitLintJoinPinPath
	, proofErasureWitLintJoinRightParent
	, reverseProofErasureWitLintJoinUpdate
} from "../tests/helpers/proof-erasure-wit-lint-join-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, proofErasureWitLintJoinImplementation
	, "WIT/lint join history requires its exact pin-refresh commit");
assert.equal(git(["rev-parse", `${proofErasureWitLintJoinImplementation}^`])
	.trim(), proofErasureWitLintJoinMerge);
assert.deepEqual(git(["show", "-s", "--format=%P"
	, proofErasureWitLintJoinMerge]).trim().split(" "), [
	proofErasureWitLintJoinLeftParent, proofErasureWitLintJoinRightParent]
);
assert.equal(git(["merge-base", proofErasureWitLintJoinLeftParent
	, proofErasureWitLintJoinRightParent]).trim()
, proofErasureWitLintJoinCommonAncestor);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${proofErasureWitLintJoinImplementation}:${proofErasureWitLintJoinHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
const leftPaths = names(["diff", "--name-only"
	, proofErasureWitLintJoinCommonAncestor
	, proofErasureWitLintJoinLeftParent]);
const rightPaths = new Set(names(["diff", "--name-only"
	, proofErasureWitLintJoinCommonAncestor
	, proofErasureWitLintJoinRightParent]));
assert.deepEqual(leftPaths.filter(path => rightPaths.has(path))
	, [...proofErasureWitLintJoinChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, proofErasureWitLintJoinMerge, proofErasureWitLintJoinImplementation])
, [proofErasureWitLintJoinPinPath]);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...proofErasureWitLintJoinIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...proofErasureWitLintJoinAddedPaths])
, [...proofErasureWitLintJoinAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-proof-wit-lint-join-"));
const lineOffsets = (source, boundaries) => {
	const offsets = new Map();
	let line = 0, offset = 0;
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
	assert.equal(reverseProofErasureWitLintJoinUpdate(current, update)
		, previous, path);
	return update;
};
const pathDigests = (revision, path) => {
	const revisions = new Set([proofErasureWitLintJoinCommonAncestor, revision
		, ...git(["rev-list"
			, `${proofErasureWitLintJoinCommonAncestor}..${revision}`
			, "--", path]).trim().split("\n").filter(Boolean)]);
	return new Set([...revisions].flatMap(commit => {
		const result = spawnSync("git", ["show", `${commit}:${path}`]
			, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
		return result.status === 0 ? [sha256(result.stdout)] : [];
	}));
};

try
{
	const leftUpdates = [];
	const rightUpdates = [];
	const leftOnlyExpectedSha256 = {};
	const rightPreferredExpectedSha256 = {};
	for(const path of proofErasureWitLintJoinChangedPaths)
	{
		const leftUpdate = await gitSourceHistoryTransition(
			path, proofErasureWitLintJoinLeftParent
			, proofErasureWitLintJoinMerge);
		const rightUpdate = await gitSourceHistoryTransition(
			path, proofErasureWitLintJoinRightParent
			, proofErasureWitLintJoinMerge);
		leftUpdates.push(leftUpdate); rightUpdates.push(rightUpdate);
		const left = pathDigests(proofErasureWitLintJoinLeftParent, path);
		const right = pathDigests(proofErasureWitLintJoinRightParent, path);
		leftOnlyExpectedSha256[path] = [...left]
			.filter(digest => !right.has(digest)).sort();
		rightPreferredExpectedSha256[path] = [...new Set([
			...[...right].filter(digest => !left.has(digest))
			, rightUpdate.previousSha256
		])].sort();
	}
	const pinUpdate = await gitSourceHistoryTransition(
		proofErasureWitLintJoinPinPath, proofErasureWitLintJoinMerge
		, proofErasureWitLintJoinImplementation
		, { maximumEditBytes: 16 * 1024 * 1024 }
	);
	assert.equal(pinUpdate.edits.length, proofErasureWitLintJoinPinCount);
	const integrationUpdates = [];
	for(const path of proofErasureWitLintJoinIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${proofErasureWitLintJoinImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of proofErasureWitLintJoinAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${proofErasureWitLintJoinImplementation}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(proofErasureWitLintJoinHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "proof-erasure-wit-lint-join-source-v1"
		, commonAncestorCommit: proofErasureWitLintJoinCommonAncestor
		, leftParentCommit: proofErasureWitLintJoinLeftParent
		, rightParentCommit: proofErasureWitLintJoinRightParent
		, mergeCommit: proofErasureWitLintJoinMerge
		, implementationCommit: proofErasureWitLintJoinImplementation
		, scope: "Authenticate the two-parent synthesis of the direct proof-erasure WIT package lane with the fixture-lint and type-surface repair. Refresh exactly 92 WIT workflow pins to the merged source, preserve both immutable parent lineages, and select the parent containing an explicitly requested digest. No support cell, runtime implementation, package observation or retained archive changes. Hosted Core and installed WIT acceptance remain terminal gates."
		, additions, leftUpdates, rightUpdates, pinUpdate, integrationUpdates
		, leftOnlyExpectedSha256, rightPreferredExpectedSha256
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${leftUpdates.length} left, `
		+ `${rightUpdates.length} right, ${pinUpdate.edits.length} pins and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
