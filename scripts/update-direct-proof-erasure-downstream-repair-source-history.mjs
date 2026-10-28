#!/usr/bin/env node
/**
 * Record the downstream refinement repairs, pin refresh and newest-first registration.
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
	directProofErasureDownstreamRepairAddedPaths
	, directProofErasureDownstreamRepairCommits
	, directProofErasureDownstreamRepairHistoryPath
	, directProofErasureDownstreamRepairImplementation
	, directProofErasureDownstreamRepairImplementationPaths
	, directProofErasureDownstreamRepairIntegrationPaths
	, directProofErasureDownstreamRepairPredecessor
	, reverseDirectProofErasureDownstreamRepairUpdate
} from "../tests/helpers/direct-proof-erasure-downstream-repair-source-history.mjs";

assert.deepEqual(process.argv.slice(2), [], "This history writer takes no arguments");
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = directProofErasureDownstreamRepairPredecessor;
const implementation = directProofErasureDownstreamRepairImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Downstream repair history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, directProofErasureDownstreamRepairCommits);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...directProofErasureDownstreamRepairImplementationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${directProofErasureDownstreamRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...directProofErasureDownstreamRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureDownstreamRepairAddedPaths])
, [...directProofErasureDownstreamRepairAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-direct-proof-downstream-repair-history-"));
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
	assert.equal(reverseDirectProofErasureDownstreamRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of directProofErasureDownstreamRepairImplementationPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor
			, implementation));
	const integrationUpdates = [];
	for(const path of directProofErasureDownstreamRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of directProofErasureDownstreamRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(directProofErasureDownstreamRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-downstream-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Repair downstream direct-proof consumers without weakening current semantics: bound cyclic dependent-Fin traversal, preserve callable source types while erasing only wire proofs, restore Perl archive tamper controls, project produced Subtype results without input constructors, authenticate the exact immutable PHP-Wasm producer-era contract, align owned PHP-Wasm checks and closed CI commands, and refresh exactly 271 current-source pins across eleven paths. Register every transition newest-first; required hosted Core, Downstream and Performance remain terminal acceptance gates."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
