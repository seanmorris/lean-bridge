#!/usr/bin/env node
/**
 * Record expanded language callers while retaining exact shared admitted boundaries.
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
	ownedCheckedLanguageMixedCoverageAddedPaths
	, ownedCheckedLanguageMixedCoverageHistoryAddedPaths
	, ownedCheckedLanguageMixedCoverageImplementationAddedPaths
	, ownedCheckedLanguageMixedCoverageImplementationPaths
	, ownedCheckedLanguageMixedCoverageChangedPaths
	, ownedCheckedLanguageMixedCoverageCommits
	, ownedCheckedLanguageMixedCoverageHistoryPath
	, ownedCheckedLanguageMixedCoverageImplementation
	, ownedCheckedLanguageMixedCoverageIntegrationBase
	, ownedCheckedLanguageMixedCoverageIntegrationPaths
	, ownedCheckedLanguageMixedCoveragePredecessor
	, reverseOwnedCheckedLanguageMixedCoverageUpdate
} from "../tests/helpers/owned-checked-language-mixed-coverage-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = ownedCheckedLanguageMixedCoveragePredecessor;
const implementation = ownedCheckedLanguageMixedCoverageImplementation;
const integrationBase = ownedCheckedLanguageMixedCoverageIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Owned checked language mixed coverage history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, ownedCheckedLanguageMixedCoverageCommits);
for(const [index, revision] of ownedCheckedLanguageMixedCoverageCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : ownedCheckedLanguageMixedCoverageCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedCheckedLanguageMixedCoverageImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...ownedCheckedLanguageMixedCoverageChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...ownedCheckedLanguageMixedCoverageImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedLanguageMixedCoverageHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedCheckedLanguageMixedCoverageIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedCheckedLanguageMixedCoverageHistoryAddedPaths])
, [...ownedCheckedLanguageMixedCoverageHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-checked-language-mixed-coverage-history-"
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
	assert.equal(reverseOwnedCheckedLanguageMixedCoverageUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of ownedCheckedLanguageMixedCoverageChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of ownedCheckedLanguageMixedCoverageIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedLanguageMixedCoverageAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(ownedCheckedLanguageMixedCoverageImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(ownedCheckedLanguageMixedCoverageHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-checked-language-mixed-coverage-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: ownedCheckedLanguageMixedCoverageCommits
			, integrationBaseCommit: integrationBase
			, scope: "Expand Python, Ruby and Rust source qualification to Grant with nested Subtype, arrays of Claim, two-input transfer rollback and post-transfer callback failure/recovery. Share the existing native mixed selection without changing any native or CPAN route. Preserve standalone result-only APIs, the shared admitted boundary and every published support observation. Require actual per-language installed execution and lifetime acceptance before promoting the new cases. Four generator/registration, four promotion and two real Lean carrier checks passed; generated Python/Ruby sources parse and the actual Rust consumer typechecks offline. Refresh exactly eleven live source pins. Preserve all original archives and prior evidence. An older language history restore exceeded a bounded 45-second local probe; stream its exact original inventory at d36bd5abf4303aab6dbdada4b33983ffc83c17cb instead, verify its implementation parent and immutable record, authenticate both endpoints and every reverse span, and reject changed endpoints, missing edits and altered spans."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
