#!/usr/bin/env node
/**
 * Record the WIT value-index verifier shadowing repair as an exact reversible
 * source layer.
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
	checkedRecordValueIndexWitVerifierRepairAddedPaths
	, checkedRecordValueIndexWitVerifierRepairChangedPaths
	, checkedRecordValueIndexWitVerifierRepairDraftParent
	, checkedRecordValueIndexWitVerifierRepairFoundationPaths
	, checkedRecordValueIndexWitVerifierRepairHistoryPath
	, checkedRecordValueIndexWitVerifierRepairPredecessor
	, reverseCheckedRecordValueIndexWitVerifierRepairUpdate
} from "../tests/helpers/checked-record-value-index-wit-verifier-repair-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexWitVerifierRepairDraftParent
	, "WIT verifier history must stay on its exact repair commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexWitVerifierRepairPredecessor
	, "WIT verifier repair must have its exact predecessor");
assert.equal(git(["ls-tree", "--name-only"
	, checkedRecordValueIndexWitVerifierRepairDraftParent, "--"
	, checkedRecordValueIndexWitVerifierRepairHistoryPath]).trim(), ""
, "Never rewrite committed WIT verifier repair history");
const draft = await readFile(
	checkedRecordValueIndexWitVerifierRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-wit-verifier-repair-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexWitVerifierRepairPredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexWitVerifierRepairDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexWitVerifierRepairPredecessor
	, checkedRecordValueIndexWitVerifierRepairDraftParent])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexWitVerifierRepairFoundationPaths].sort());
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexWitVerifierRepairPredecessor
	, checkedRecordValueIndexWitVerifierRepairDraftParent])
	.trim().split("\n").filter(Boolean), []);
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexWitVerifierRepairAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexWitVerifierRepairAddedPaths].sort());

const sources = new Map();
for(const path of checkedRecordValueIndexWitVerifierRepairChangedPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexWitVerifierRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexWitVerifierRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexWitVerifierRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-wit-verifier-history-"
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
			, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
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
	for(const path of checkedRecordValueIndexWitVerifierRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCheckedRecordValueIndexWitVerifierRepairUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-record-value-index-wit-verifier-repair-v1"
		, predecessorCommit: checkedRecordValueIndexWitVerifierRepairPredecessor
		, draftParentCommit: checkedRecordValueIndexWitVerifierRepairDraftParent
		, pathsSha256: sha256(JSON.stringify(
			checkedRecordValueIndexWitVerifierRepairChangedPaths))
		, additions, updates
	}, null, 2) + "\n";
	await writeFile(checkedRecordValueIndexWitVerifierRepairHistoryPath
		, record, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} WIT verifier transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
