#!/usr/bin/env node
/**
 * Record the Perl dependent-refinement rejection correction and central
 * history registration.
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
	perlDependentRefinementRejectionAddedPaths
	, perlDependentRefinementRejectionCommits
	, perlDependentRefinementRejectionHistoryPath
	, perlDependentRefinementRejectionImplementation
	, perlDependentRefinementRejectionImplementationPaths
	, perlDependentRefinementRejectionIntegrationPaths
	, perlDependentRefinementRejectionPredecessor
	, reversePerlDependentRefinementRejectionUpdate
} from "../tests/helpers/perl-dependent-refinement-rejection-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = perlDependentRefinementRejectionPredecessor;
const implementation = perlDependentRefinementRejectionImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Perl rejection history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, perlDependentRefinementRejectionCommits);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...perlDependentRefinementRejectionImplementationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${perlDependentRefinementRejectionHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...perlDependentRefinementRejectionIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...perlDependentRefinementRejectionAddedPaths])
, [...perlDependentRefinementRejectionAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-perl-dependent-rejection-history-"));
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
	assert.equal(reversePerlDependentRefinementRejectionUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of perlDependentRefinementRejectionImplementationPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor
			, implementation, { maximumEditBytes: 16 * 1024 * 1024 }));
	const integrationUpdates = [];
	for(const path of perlDependentRefinementRejectionIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of perlDependentRefinementRejectionAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(perlDependentRefinementRejectionHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "perl-dependent-refinement-rejection-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Update the direct native-component refusal for a dependent Fin export to the exact bound-checking-adapter capability diagnostic, extend the bounded test budget so all seven fresh Lean selections complete, and refresh exactly two live source pins. This does not change dependent Fin support: prepared Perl packages continue to enable their checked adapter, while the raw builder must refuse without it. Register the transition newest-first; hosted Perl and Core remain terminal gates."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
