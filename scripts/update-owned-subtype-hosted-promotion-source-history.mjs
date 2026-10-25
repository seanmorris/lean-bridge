#!/usr/bin/env node
/**
 * Record hosted Subtype promotion and preserve original installed evidence.
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
	ownedSubtypeHostedPromotionAddedPaths
	, ownedSubtypeHostedPromotionHistoryAddedPaths
	, ownedSubtypeHostedPromotionImplementationAddedPaths
	, ownedSubtypeHostedPromotionImplementationPaths
	, ownedSubtypeHostedPromotionChangedPaths
	, ownedSubtypeHostedPromotionCommits
	, ownedSubtypeHostedPromotionHistoryPath
	, ownedSubtypeHostedPromotionImplementation
	, ownedSubtypeHostedPromotionIntegrationBase
	, ownedSubtypeHostedPromotionIntegrationPaths
	, ownedSubtypeHostedPromotionPredecessor
	, reverseOwnedSubtypeHostedPromotionUpdate
} from "../tests/helpers/owned-subtype-hosted-promotion-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = ownedSubtypeHostedPromotionPredecessor;
const implementation = ownedSubtypeHostedPromotionImplementation;
const integrationBase = ownedSubtypeHostedPromotionIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Owned Subtype hosted promotion history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, ownedSubtypeHostedPromotionCommits);
for(const [index, revision] of ownedSubtypeHostedPromotionCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : ownedSubtypeHostedPromotionCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedSubtypeHostedPromotionImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...ownedSubtypeHostedPromotionChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...ownedSubtypeHostedPromotionImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedSubtypeHostedPromotionHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedSubtypeHostedPromotionIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedSubtypeHostedPromotionHistoryAddedPaths])
, [...ownedSubtypeHostedPromotionHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-subtype-hosted-promotion-history-"
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
	assert.equal(reverseOwnedSubtypeHostedPromotionUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(git(["merge-base", implementation, integrationBase]).trim(), implementation);
	for(const path of ownedSubtypeHostedPromotionChangedPaths)
		assert.equal(git(["rev-parse", `${implementation}:${path}`])
			, git(["rev-parse", `${integrationBase}:${path}`]), path);
	const updates = [];
	for(const path of ownedSubtypeHostedPromotionChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of ownedSubtypeHostedPromotionIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedSubtypeHostedPromotionAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(ownedSubtypeHostedPromotionImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(ownedSubtypeHostedPromotionHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-subtype-hosted-promotion-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: ownedSubtypeHostedPromotionCommits
			, integrationBaseCommit: integrationBase
			, scope: "Require complete original hosted evidence for all eight owned-Subtype lanes, with exact archive dates and producer/run/job identities. Retain the historical local JavaScript qualification only for historical checks. Replace skippable replay selectors with a required direct CLI, replay serially, preserve all archived payloads without cloning them, and require hosted JavaScript in generated consumer guidance. Register the new verifier controls in Core and refresh exactly 230 live source pins. This source milestone does not promote any support cell or establish new installed-runtime acceptance; original npm capture, full eight-lane promotion, documentation publication and final gates remain pending."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
