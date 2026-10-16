#!/usr/bin/env node
/**
 * Record the recursive-to-mutual checked-record transition at its exact draft parent.
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
	mutualCheckedRecordChangedPaths
	, mutualCheckedRecordDraftParent
	, mutualCheckedRecordHistoryPath
	, mutualCheckedRecordPredecessor
	, reverseMutualCheckedRecordUpdate
} from "../tests/helpers/mutual-checked-record-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim(), mutualCheckedRecordDraftParent
	, "mutual checked-record history is draft-only at its exact parent");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--"
	, mutualCheckedRecordHistoryPath]).trim()
, "Never rewrite a committed mutual checked-record ledger");

const inventoryPath = "docs/type-surface.v1.json";
const inventoryBefore = git(["show", `${mutualCheckedRecordPredecessor}:${inventoryPath}`]);
const draft = await readFile(mutualCheckedRecordHistoryPath, "utf8")
	.then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft)
{
	assert.ok([mutualCheckedRecordPredecessor, mutualCheckedRecordDraftParent]
		.includes(draft.predecessorCommit));
	assert.equal(draft.draftParentCommit, mutualCheckedRecordDraftParent);
}
const currentInventory = await readFile(inventoryPath, "utf8");
const draftInventory = draft?.updates.find(item => item.path === inventoryPath);
const restoredInventory = draftInventory?.currentSha256 === sha256(currentInventory)
	? reverseMutualCheckedRecordUpdate(currentInventory, draftInventory)
	: currentInventory;
assert.equal(restoredInventory, inventoryBefore
	, "Never overwrite unrecorded type-surface changes");

const sources = new Map();
for(const path of mutualCheckedRecordChangedPaths)
{
	if(path === inventoryPath) continue;
	const previous = git(["show", `${mutualCheckedRecordPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}

const inventory = JSON.parse(inventoryBefore);
let pinCount = 0;
for(const entry of inventory.evidence) for(const file of entry.files)
{
	const source = sources.get(file.path);
	if(source && file.sha256 === sha256(source.previous))
	{
		file.sha256 = sha256(source.current);
		pinCount++;
	}
}
assert.ok(pinCount > 0
	, "The mutual checked-record transition must refresh current-source pins");
const inventoryAfter = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, { previous: inventoryBefore, current: inventoryAfter });

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-mutual-checked-record-history-draft-"
));
try
{
	const transition = async path => {
		const { previous, current } = sources.get(path);
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
		const currentLines = current.split(/(?<=\n)/u);
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
			, currentSha256: sha256(current), edits
		};
		assert.equal(reverseMutualCheckedRecordUpdate(current, update), previous);
		return update;
	};
	const updates = [];
	for(const path of mutualCheckedRecordChangedPaths)
		updates.push(await transition(path));
	await writeFile(inventoryPath, inventoryAfter);
	const record = JSON.stringify({
		schemaVersion: 1, milestone: "mutual-checked-record-source-v1"
		, predecessorCommit: mutualCheckedRecordPredecessor
		, draftParentCommit: mutualCheckedRecordDraftParent
		, pinCount, updates
	}, null, 2) + "\n";
	await writeFile(mutualCheckedRecordHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} exact source transitions and refreshed ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
