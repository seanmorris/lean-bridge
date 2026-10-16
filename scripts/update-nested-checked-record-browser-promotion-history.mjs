#!/usr/bin/env node
/**
 * Record the nested checked-record npm/browser promotion once at its exact parent.
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
	nestedCheckedRecordBrowserReferences,
	promoteNestedCheckedRecordBrowsers
} from "../tests/helpers/nested-checked-record-browser-promotion.mjs";
import {
	nestedCheckedRecordBrowserPromotionChangedPaths,
	nestedCheckedRecordBrowserPromotionDraftParent,
	nestedCheckedRecordBrowserPromotionHistoryPath,
	nestedCheckedRecordBrowserPromotionPredecessor,
	reverseNestedCheckedRecordBrowserPromotionUpdate
} from "../tests/helpers/nested-checked-record-browser-promotion-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, nestedCheckedRecordBrowserPromotionDraftParent
	, "nested checked-record browser promotion history is draft-only at its exact parent");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--"
	, nestedCheckedRecordBrowserPromotionHistoryPath]).trim()
, "Never rewrite a committed nested checked-record browser promotion ledger");

const inventoryPath = "docs/type-surface.v1.json";
const baseline = JSON.parse(git(["show"
	, `${nestedCheckedRecordBrowserPromotionPredecessor}:${inventoryPath}`]));
const promoted = await promoteNestedCheckedRecordBrowsers(
	baseline, await nestedCheckedRecordBrowserReferences()
);
const comparable = inventory => {
	const copy = structuredClone(inventory);
	for(const entry of copy.evidence) for(const file of entry.files)
		file.sha256 = "source-pin";
	return copy;
};
assert.deepEqual(
	comparable(JSON.parse(await readFile(inventoryPath, "utf8")))
	, comparable(promoted)
	, "Never overwrite unrecorded inventory changes"
);
const inventoryText = `${JSON.stringify(promoted, null, 2)}\n`;

const directory = await mkdtemp(join(tmpdir()
	, "lean-bridge-nested-record-browser-promotion-history-draft-"));
try
{
	const transition = async path => {
		const source = path === inventoryPath
			? inventoryText : await readFile(path, "utf8");
		const previous = git(["show"
			, `${nestedCheckedRecordBrowserPromotionPredecessor}:${path}`]);
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous); await writeFile(currentPath, source);
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
				, previous: previousLines.slice(previousStart
					, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart
					, currentStart + currentCount).join("")
			};
		});
		const update = {
			path, previousSha256: sha256(previous)
			, currentSha256: sha256(source), edits
		};
		assert.equal(reverseNestedCheckedRecordBrowserPromotionUpdate(source, update)
			, previous);
		return update;
	};
	const updates = [];
	for(const path of nestedCheckedRecordBrowserPromotionChangedPaths)
		updates.push(await transition(path));
	await writeFile(inventoryPath, inventoryText);
	await writeFile(nestedCheckedRecordBrowserPromotionHistoryPath, JSON.stringify({
		schemaVersion: 1, milestone: "nested-checked-record-browser-promotion-v1"
		, predecessorCommit: nestedCheckedRecordBrowserPromotionPredecessor
		, draftParentCommit: nestedCheckedRecordBrowserPromotionDraftParent
		, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} nested checked-record browser promotion transitions.\n`);
}
finally
{ await rm(directory, { recursive: true }); }
