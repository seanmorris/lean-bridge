#!/usr/bin/env node
/**
 * Record the owned-Subtype hosted-archive foundation.
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
	ownedSubtypeHostedArchiveAddedPaths
	, ownedSubtypeHostedArchiveCommits
	, ownedSubtypeHostedArchiveHistoryPath
	, ownedSubtypeHostedArchiveImplementation
	, ownedSubtypeHostedArchiveImplementationAdditions
	, ownedSubtypeHostedArchiveImplementationPaths
	, ownedSubtypeHostedArchiveIntegrationPaths
	, ownedSubtypeHostedArchiveModifiedPaths
	, ownedSubtypeHostedArchivePredecessor
	, reverseOwnedSubtypeHostedArchiveUpdate
} from "../tests/helpers/owned-subtype-hosted-archive-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedSubtypeHostedArchiveImplementation
	, "Owned Subtype hosted-archive history requires its implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${ownedSubtypeHostedArchivePredecessor}..${ownedSubtypeHostedArchiveImplementation}`])
	.trim().split("\n"), ownedSubtypeHostedArchiveCommits);
assert.deepEqual(git(["diff", "--name-only"
	, ownedSubtypeHostedArchivePredecessor
	, ownedSubtypeHostedArchiveImplementation]).trim().split("\n").sort()
, [...ownedSubtypeHostedArchiveImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedSubtypeHostedArchiveHistoryPath]).trim(), "");

const directory = await mkdtemp(join(tmpdir()
	, "lean-owned-subtype-hosted-archive-history-"));
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
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseOwnedSubtypeHostedArchiveUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedSubtypeHostedArchiveModifiedPaths)
		updates.push(await transition(path
			, git(["show", `${ownedSubtypeHostedArchivePredecessor}:${path}`])
			, git(["show", `${ownedSubtypeHostedArchiveImplementation}:${path}`])));
	const implementationAdditions = [];
	for(const path of ownedSubtypeHostedArchiveImplementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypeHostedArchivePredecessor, "--", path]).trim(), "", path);
		implementationAdditions.push({
			path
			, currentSha256: sha256(git(["show"
				, `${ownedSubtypeHostedArchiveImplementation}:${path}`]))
		});
	}
	const integrationUpdates = [];
	for(const path of ownedSubtypeHostedArchiveIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${ownedSubtypeHostedArchiveImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedSubtypeHostedArchiveAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypeHostedArchivePredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedSubtypeHostedArchiveHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "owned-subtype-hosted-archive-v1"
		, predecessorCommit: ownedSubtypeHostedArchivePredecessor
		, implementationCommit: ownedSubtypeHostedArchiveImplementation
		, implementationCommits: ownedSubtypeHostedArchiveCommits
		, scope: "Define seven immutable owned-Subtype hosted archives with original ZIP parts, GitHub API bytes, complete output, retained packages, exact four-role source closures and independent replay."
		, implementationAdditions, updates, additions, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} update, `
		+ `${implementationAdditions.length} implementation additions and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
