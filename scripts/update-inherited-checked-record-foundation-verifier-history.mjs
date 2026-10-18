#!/usr/bin/env node
/**
 * Record the exact inherited checked-record foundation verifier repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	inheritedCheckedRecordFoundationVerifierAddedPaths
	, inheritedCheckedRecordFoundationVerifierChangedPaths
	, inheritedCheckedRecordFoundationVerifierDraftParent
	, inheritedCheckedRecordFoundationVerifierHistoricalCommits
	, inheritedCheckedRecordFoundationVerifierHistoricalPaths
	, inheritedCheckedRecordFoundationVerifierHistoryPath
	, inheritedCheckedRecordFoundationVerifierPredecessor
	, reverseInheritedCheckedRecordFoundationVerifierUpdate
} from "../tests/helpers/inherited-checked-record-foundation-verifier-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, inheritedCheckedRecordFoundationVerifierDraftParent
	, "Foundation verifier history must stay on its exact draft parent");
assert.equal(inheritedCheckedRecordFoundationVerifierPredecessor
	, inheritedCheckedRecordFoundationVerifierDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, inheritedCheckedRecordFoundationVerifierDraftParent, "--"
	, inheritedCheckedRecordFoundationVerifierHistoryPath]).trim(), ""
, "Never rewrite committed foundation verifier history");
const draft = await readFile(
	inheritedCheckedRecordFoundationVerifierHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "inherited-checked-record-foundation-verifier-source-v1");
	assert.equal(draft.predecessorCommit
		, inheritedCheckedRecordFoundationVerifierPredecessor);
	assert.equal(draft.draftParentCommit
		, inheritedCheckedRecordFoundationVerifierDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, inheritedCheckedRecordFoundationVerifierPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...inheritedCheckedRecordFoundationVerifierChangedPaths].sort());

const sources = new Map();
for(const path of inheritedCheckedRecordFoundationVerifierChangedPaths)
{
	const previous = git(["show"
		, `${inheritedCheckedRecordFoundationVerifierPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of inheritedCheckedRecordFoundationVerifierAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${inheritedCheckedRecordFoundationVerifierPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-foundation-verifier-history-"
));
try
{
	const edits = async (previous, current) => {
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(
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
		assert.ok(result.length > 0);
		return result;
	};
	const updates = [];
	for(const path of inheritedCheckedRecordFoundationVerifierChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseInheritedCheckedRecordFoundationVerifierUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const historicalTransitions = [];
	for(const commit of inheritedCheckedRecordFoundationVerifierHistoricalCommits)
	{
		const predecessorCommit = git(["rev-parse", `${commit}^`]).trim();
		const historicalUpdates = [];
		for(const path of inheritedCheckedRecordFoundationVerifierHistoricalPaths)
		{
			const previous = git(["show", `${predecessorCommit}:${path}`]);
			const current = git(["show", `${commit}:${path}`]);
			assert.notEqual(current, previous, `${commit}:${path}`);
			const update = {
				path, previousSha256: sha256(previous)
				, currentSha256: sha256(current)
				, edits: await edits(previous, current)
			};
			assert.equal(reverseInheritedCheckedRecordFoundationVerifierUpdate(
				current, update), previous);
			historicalUpdates.push(update);
		}
		historicalTransitions.push({
			commit, predecessorCommit, updates: historicalUpdates
		});
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "inherited-checked-record-foundation-verifier-source-v1"
		, predecessorCommit: inheritedCheckedRecordFoundationVerifierPredecessor
		, draftParentCommit: inheritedCheckedRecordFoundationVerifierDraftParent
		, pathsSha256: sha256(JSON.stringify(
			inheritedCheckedRecordFoundationVerifierChangedPaths))
		, pinCount: 0, pinUpdates: []
		, historicalTransitions, additions, updates
	}, null, 2) + "\n";
	await writeFile(inheritedCheckedRecordFoundationVerifierHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} foundation verifier transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
