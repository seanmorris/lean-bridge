#!/usr/bin/env node
/**
 * Record exact aligned owned checked-record publication source transitions.
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
	ownedCheckedAlignedPublicationAddedPaths
	, ownedCheckedAlignedPublicationHistoryAddedPaths
	, ownedCheckedAlignedPublicationImplementationAddedPaths
	, ownedCheckedAlignedPublicationImplementationPaths
	, ownedCheckedAlignedPublicationChangedPaths
	, ownedCheckedAlignedPublicationCommits
	, ownedCheckedAlignedPublicationHistoryPath
	, ownedCheckedAlignedPublicationImplementation
	, ownedCheckedAlignedPublicationIntegrationBase
	, ownedCheckedAlignedPublicationIntegrationPaths
	, ownedCheckedAlignedPublicationPredecessor
	, reverseOwnedCheckedAlignedPublicationUpdate
} from "../tests/helpers/owned-checked-record-aligned-publication-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const predecessor = ownedCheckedAlignedPublicationPredecessor;
const implementation = ownedCheckedAlignedPublicationImplementation;
const integrationBase = ownedCheckedAlignedPublicationIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Aligned owned checked-record publication history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`])
	.trim().split("\n"), ownedCheckedAlignedPublicationCommits);
for(const [index, revision] of ownedCheckedAlignedPublicationCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : ownedCheckedAlignedPublicationCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedCheckedAlignedPublicationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...ownedCheckedAlignedPublicationChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...ownedCheckedAlignedPublicationImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedAlignedPublicationHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...ownedCheckedAlignedPublicationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedCheckedAlignedPublicationHistoryAddedPaths])
, [...ownedCheckedAlignedPublicationHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-owned-checked-aligned-publication-history-"));
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
			, "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const hunks = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)]
		.map(match => {
			const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
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
	assert.equal(reverseOwnedCheckedAlignedPublicationUpdate(current, update), previous, path);
	return update;
};

try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of ownedCheckedAlignedPublicationChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of ownedCheckedAlignedPublicationIntegrationPaths)
		integrationUpdates.push(await transition(path, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedAlignedPublicationAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path]).trim(), "", path);
		const bytes = await readFile(path);
		if(ownedCheckedAlignedPublicationImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	const value = {
		schemaVersion: 1
		, milestone: "owned-checked-record-aligned-publication-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, implementationCommits: ownedCheckedAlignedPublicationCommits
		, integrationBaseCommit: integrationBase
		, scope: "Publish the complete aligned owned checked-record selection through the canonical inventory and every affected generated, author and consumer document. Authenticate eleven original hosted archives, forty-four installed routes, 17 profiles, 170 checked-record cells and 18,402 committed files totaling 4,676,061,081 bytes. Preserve every support observation, including the separately accepted owned Subtype matrix. Refresh exactly 243 live source pins and retain the full transactional preflight, publication receipt and immutable prior evidence. This milestone does not replace the remaining original per-host and shared semantic audits or the final current-source Core, hosted and recurring gates."
		, additions, updates, integrationUpdates
	};
	await writeFile(ownedCheckedAlignedPublicationHistoryPath, canonicalJson(value), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
