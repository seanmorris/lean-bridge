#!/usr/bin/env node
/**
 * Record the authenticated two-parent proof/Core local join.
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
	proofCoreLocalJoinAddedPaths
	, proofCoreLocalJoinChangedPaths
	, proofCoreLocalJoinCommonAncestor
	, proofCoreLocalJoinHistoryPath
	, proofCoreLocalJoinLeftParent
	, proofCoreLocalJoinMerge
	, proofCoreLocalJoinRightParent
	, reverseProofCoreLocalJoinUpdate
} from "../tests/helpers/proof-core-local-join-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim(), proofCoreLocalJoinMerge
	, "Proof/Core local-join history requires its exact merge commit");
const mergeParents = git(["show", "-s", "--format=%P"
	, proofCoreLocalJoinMerge]).trim().split(" ");
assert.deepEqual(mergeParents, [
	proofCoreLocalJoinLeftParent, proofCoreLocalJoinRightParent
]);
assert.equal(git(["merge-base", proofCoreLocalJoinLeftParent
	, proofCoreLocalJoinRightParent]).trim(), proofCoreLocalJoinCommonAncestor);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${proofCoreLocalJoinMerge}:${proofCoreLocalJoinHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
const leftPaths = names(["diff", "--name-only"
	, proofCoreLocalJoinCommonAncestor, proofCoreLocalJoinLeftParent]);
const rightPaths = new Set(names(["diff", "--name-only"
	, proofCoreLocalJoinCommonAncestor, proofCoreLocalJoinRightParent]));
assert.deepEqual(leftPaths.filter(path => rightPaths.has(path))
	, [...proofCoreLocalJoinChangedPaths].sort());
const integrationPaths = proofCoreLocalJoinChangedPaths.filter(path =>
	spawnSync("git", ["diff", "--quiet", "HEAD", "--", path]).status === 1);
assert.deepEqual(integrationPaths, [
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...proofCoreLocalJoinAddedPaths]), [...proofCoreLocalJoinAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-proof-core-join-"));
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
	assert.equal(reverseProofCoreLocalJoinUpdate(current, update)
		, previous, path);
	return update;
};
const pathDigests = (revision, path) => {
	const revisions = new Set([proofCoreLocalJoinCommonAncestor, revision
		, ...git(["rev-list", `${proofCoreLocalJoinCommonAncestor}..${revision}`
			, "--", path]).trim().split("\n").filter(Boolean)]);
	return new Set([...revisions].flatMap(commit => {
		const result = spawnSync("git", ["show", `${commit}:${path}`]
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
		return result.status === 0 ? [sha256(result.stdout)] : [];
	}));
};

try
{
	const leftUpdates = [];
	const rightUpdates = [];
	const leftOnlyExpectedSha256 = {};
	const rightPreferredExpectedSha256 = {};
	for(const path of proofCoreLocalJoinChangedPaths)
	{
		const leftUpdate = await gitSourceHistoryTransition(
			path, proofCoreLocalJoinLeftParent, proofCoreLocalJoinMerge);
		const rightUpdate = await gitSourceHistoryTransition(
			path, proofCoreLocalJoinRightParent, proofCoreLocalJoinMerge);
		leftUpdates.push(leftUpdate);
		rightUpdates.push(rightUpdate);
		const left = pathDigests(proofCoreLocalJoinLeftParent, path);
		const right = pathDigests(proofCoreLocalJoinRightParent, path);
		leftOnlyExpectedSha256[path] = [...left]
			.filter(digest => !right.has(digest)).sort();
		rightPreferredExpectedSha256[path] = [...new Set([
			...[...right].filter(digest => !left.has(digest))
			, rightUpdate.previousSha256
		])].sort();
	}
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${proofCoreLocalJoinMerge}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of proofCoreLocalJoinAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${proofCoreLocalJoinMerge}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(proofCoreLocalJoinHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "proof-core-local-join-source-v1"
		, commonAncestorCommit: proofCoreLocalJoinCommonAncestor
		, leftParentCommit: proofCoreLocalJoinLeftParent
		, rightParentCommit: proofCoreLocalJoinRightParent
		, mergeCommit: proofCoreLocalJoinMerge
		, scope: "Authenticate the two-parent synthesis of the proof-erasure and Core signature-completion histories. Preserve both immutable parent lineages and select the parent containing an explicitly requested digest before continuing through the shared Fin-history normalizer. No runtime, package, type-surface, observation or support claim changes. Final exact-head Core and installed consumer acceptance remain required."
		, additions, leftUpdates, rightUpdates, integrationUpdates
		, leftOnlyExpectedSha256, rightPreferredExpectedSha256
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${leftUpdates.length} left, `
		+ `${rightUpdates.length} right and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
