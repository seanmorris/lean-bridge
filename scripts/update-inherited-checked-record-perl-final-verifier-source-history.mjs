#!/usr/bin/env node
/**
 * Record the final post-archive Perl verifier hardening.
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
	inheritedCheckedRecordPerlFinalVerifierAddedPaths
	, inheritedCheckedRecordPerlFinalVerifierChangedPaths
	, inheritedCheckedRecordPerlFinalVerifierDraftParent
	, inheritedCheckedRecordPerlFinalVerifierHistoryPath
	, inheritedCheckedRecordPerlFinalVerifierPredecessor
	, reverseInheritedCheckedRecordPerlFinalVerifierUpdate
} from "../tests/helpers/inherited-checked-record-perl-final-verifier-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, inheritedCheckedRecordPerlFinalVerifierDraftParent
	, "Final Perl verifier history must stay on its exact draft parent");
assert.equal(inheritedCheckedRecordPerlFinalVerifierPredecessor
	, inheritedCheckedRecordPerlFinalVerifierDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, inheritedCheckedRecordPerlFinalVerifierDraftParent, "--"
	, inheritedCheckedRecordPerlFinalVerifierHistoryPath]).trim(), ""
, "Never rewrite committed final Perl verifier history");
const draft = await readFile(
	inheritedCheckedRecordPerlFinalVerifierHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "inherited-checked-record-perl-final-verifier-source-v1");
	assert.equal(draft.predecessorCommit
		, inheritedCheckedRecordPerlFinalVerifierPredecessor);
	assert.equal(draft.draftParentCommit
		, inheritedCheckedRecordPerlFinalVerifierDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, inheritedCheckedRecordPerlFinalVerifierPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...inheritedCheckedRecordPerlFinalVerifierChangedPaths].sort());

const sources = new Map();
for(const path of inheritedCheckedRecordPerlFinalVerifierChangedPaths)
{
	const previous = git(["show"
		, `${inheritedCheckedRecordPerlFinalVerifierPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of inheritedCheckedRecordPerlFinalVerifierAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${inheritedCheckedRecordPerlFinalVerifierPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-inherited-perl-final-verifier-history-"
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
	for(const path of inheritedCheckedRecordPerlFinalVerifierChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseInheritedCheckedRecordPerlFinalVerifierUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "inherited-checked-record-perl-final-verifier-source-v1"
		, predecessorCommit: inheritedCheckedRecordPerlFinalVerifierPredecessor
		, draftParentCommit: inheritedCheckedRecordPerlFinalVerifierDraftParent
		, pathsSha256: sha256(JSON.stringify(
			inheritedCheckedRecordPerlFinalVerifierChangedPaths))
		, additions, updates
	}, null, 2) + "\n";
	await writeFile(inheritedCheckedRecordPerlFinalVerifierHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} final Perl verifier transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
