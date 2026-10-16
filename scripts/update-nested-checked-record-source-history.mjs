#!/usr/bin/env node
/**
 * Record the exact nested checked-record compiler transition once.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	nestedCheckedRecordChangedPaths,
	nestedCheckedRecordDraftParent,
	nestedCheckedRecordHistoryPath,
	nestedCheckedRecordPredecessor,
	reverseNestedCheckedRecordUpdate
} from "../tests/helpers/nested-checked-record-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 32 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim(), nestedCheckedRecordDraftParent
	, "nested checked-record history is draft-only at its exact parent; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", nestedCheckedRecordHistoryPath]).trim()
	, "Never rewrite a committed nested checked-record ledger");

const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nested-record-history-draft-"));
try
{
	const transition = async path => {
		const source = await readFile(path, "utf8");
		const previous = git(["show", `${nestedCheckedRecordPredecessor}:${path}`]);
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous); await writeFile(currentPath, source);
		let diff;
		try
		{
			diff = execFileSync("diff", [
				"--speed-large-files", "--unified=0", previousPath, currentPath
			], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const currentLines = source.split(/(?<=\n)/u);
		const previousLines = previous.split(/(?<=\n)/u);
		const edits = [...diff.matchAll(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
		)].map(match => {
			const previousCount = Number(match[2] ?? 1);
			const currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return {
				start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart, currentStart + currentCount).join("")
			};
		});
		const update = {
			path, currentSha256: sha256(source), previousSha256: sha256(previous), edits
		};
		assert.equal(reverseNestedCheckedRecordUpdate(source, update), previous);
		return update;
	};
	const updates = [];
	for(const path of nestedCheckedRecordChangedPaths) updates.push(await transition(path));
	await writeFile(nestedCheckedRecordHistoryPath, JSON.stringify({
		schemaVersion: 1, milestone: "nested-checked-record-source-v1"
		, predecessorCommit: nestedCheckedRecordPredecessor
		, draftParentCommit: nestedCheckedRecordDraftParent, updates
	}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} nested checked-record source transitions.\n`);
}
finally
{ await rm(directory, { recursive: true }); }
