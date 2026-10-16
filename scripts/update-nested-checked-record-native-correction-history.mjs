#!/usr/bin/env node
/**
 * Record the nested checked-record native corrections without rewriting older ledgers.
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
	nestedCheckedRecordNativeCorrectionChangedPaths
	, nestedCheckedRecordNativeCorrectionDraftParent
	, nestedCheckedRecordNativeCorrectionHistoryPath
	, nestedCheckedRecordNativeCorrectionNativePaths
	, nestedCheckedRecordNativeCorrectionSourcePredecessor
	, reverseNestedCheckedRecordNativeCorrectionUpdate
} from "../tests/helpers/nested-checked-record-native-correction-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 32 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim(),
	nestedCheckedRecordNativeCorrectionDraftParent,
	"nested native correction history is draft-only at its exact integration parent; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--"
	, nestedCheckedRecordNativeCorrectionHistoryPath]).trim(),
"Never rewrite a committed nested native correction ledger");

const inventoryPath = "docs/type-surface.v1.json";
const baselineText = git(["show"
	, `${nestedCheckedRecordNativeCorrectionDraftParent}:${inventoryPath}`]);
const draft = await readFile(nestedCheckedRecordNativeCorrectionHistoryPath, "utf8")
	.then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft)
{
	assert.equal(draft.sourcePredecessorCommit,
		nestedCheckedRecordNativeCorrectionSourcePredecessor);
	assert.equal(draft.draftParentCommit,
		nestedCheckedRecordNativeCorrectionDraftParent);
}
const existingInventoryText = await readFile(inventoryPath, "utf8");
const priorInventory = draft?.updates.find(item => item.path === inventoryPath);
const restoredInventoryText = priorInventory?.currentSha256 === sha256(existingInventoryText)
	? reverseNestedCheckedRecordNativeCorrectionUpdate(
		existingInventoryText, priorInventory
	) : existingInventoryText;
assert.equal(restoredInventoryText, baselineText,
	"The support inventory must reduce to the exact integrated parent");
const inventory = JSON.parse(baselineText);
const nativePaths = new Set(nestedCheckedRecordNativeCorrectionNativePaths);
const previousCommit = path => nativePaths.has(path)
	? nestedCheckedRecordNativeCorrectionSourcePredecessor
	: nestedCheckedRecordNativeCorrectionDraftParent;
const sources = new Map();
for(const path of nestedCheckedRecordNativeCorrectionChangedPaths
	.filter(path => path !== inventoryPath)){
	const previousRevision = previousCommit(path);
	const previous = git(["show", `${previousRevision}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, {
		previousCommit: previousRevision
		, previous: sha256(previous)
		, current: sha256(current)
	});
	}

let pins = 0;
for(const entry of inventory.evidence) for(const file of entry.files)
{
	const update = sources.get(file.path);
	if(!update || update.previous === update.current || file.sha256 !== update.previous)
		continue;
	file.sha256 = update.current;
	pins++;
}
assert.ok(pins > 0, "At least one stale exact source pin must be refreshed");
const inventoryText = JSON.stringify(inventory, null, 2) + "\n";

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-nested-native-correction-history-draft-"
));
try
{
	const transition = async path => {
		const source = path === inventoryPath ? inventoryText : await readFile(path, "utf8");
		const previousRevision = previousCommit(path);
		const previous = git(["show", `${previousRevision}:${path}`]);
		assert.notEqual(source, previous, path);
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, source);
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
				, previous: previousLines.slice(
					previousStart, previousStart + previousCount
				).join("")
				, current: currentLines.slice(
					currentStart, currentStart + currentCount
				).join("")
			};
		});
		const update = {
			path, previousCommit: previousRevision
			, currentSha256: sha256(source), previousSha256: sha256(previous), edits
		};
		assert.equal(reverseNestedCheckedRecordNativeCorrectionUpdate(source, update), previous);
		return update;
	};
	const updates = [];
	for(const path of nestedCheckedRecordNativeCorrectionChangedPaths)
		updates.push(await transition(path));
	await writeFile(inventoryPath, inventoryText);
	await writeFile(nestedCheckedRecordNativeCorrectionHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "nested-checked-record-native-correction-source-v1"
		, sourcePredecessorCommit: nestedCheckedRecordNativeCorrectionSourcePredecessor
		, draftParentCommit: nestedCheckedRecordNativeCorrectionDraftParent
		, pinCount: pins
		, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact source transitions and refreshed ${pins} source pins without changing support claims.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
