#!/usr/bin/env node
/**
 * Record the inherited checked-record Perl type-surface pin repair without
 * changing any earlier source-history ledger.
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
	inheritedCheckedRecordPerlPinRepairAddedPaths
	, inheritedCheckedRecordPerlPinRepairChangedPaths
	, inheritedCheckedRecordPerlPinRepairDraftParent
	, inheritedCheckedRecordPerlPinRepairHistoryPath
	, inheritedCheckedRecordPerlPinRepairPins
	, inheritedCheckedRecordPerlPinRepairPredecessor
	, reverseInheritedCheckedRecordPerlPinRepairUpdate
} from "../tests/helpers/inherited-checked-record-perl-pin-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const sourcePaths = inheritedCheckedRecordPerlPinRepairChangedPaths
	.filter(path => path !== inventoryPath);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, inheritedCheckedRecordPerlPinRepairDraftParent
	, "Inherited Perl pin repair must stay on its exact draft parent");
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, inheritedCheckedRecordPerlPinRepairPredecessor
	, inheritedCheckedRecordPerlPinRepairDraftParent]).status, 0
, "Inherited Perl pin-repair predecessor must remain an ancestor");
assert.equal(git(["ls-tree", "--name-only"
	, inheritedCheckedRecordPerlPinRepairDraftParent, "--"
	, inheritedCheckedRecordPerlPinRepairHistoryPath]).trim(), ""
, "Never rewrite a committed inherited Perl pin-repair ledger");
const draft = await readFile(
	inheritedCheckedRecordPerlPinRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "inherited-checked-record-perl-pin-repair-source-v1");
	assert.equal(draft.predecessorCommit
		, inheritedCheckedRecordPerlPinRepairPredecessor);
	assert.equal(draft.draftParentCommit
		, inheritedCheckedRecordPerlPinRepairDraftParent);
}

const inventoryPrevious = git(["show"
	, `${inheritedCheckedRecordPerlPinRepairPredecessor}:${inventoryPath}`]);
for(const pin of inheritedCheckedRecordPerlPinRepairPins)
{
	assert.equal(sha256(await readFile(pin.path)), pin.currentSha256, pin.path);
	assert.notEqual(pin.currentSha256, pin.previousSha256, pin.path);
}
const pinsByPath = new Map(inheritedCheckedRecordPerlPinRepairPins
	.map(pin => [pin.path, pin]));
const inventory = JSON.parse(inventoryPrevious);
const actualPinCounts = new Map(inheritedCheckedRecordPerlPinRepairPins
	.map(pin => [pin.path, 0]));
for(const evidence of inventory.evidence) for(const file of evidence.files)
	if(pinsByPath.has(file.path))
	{
		const pin = pinsByPath.get(file.path);
		assert.equal(file.sha256, pin.previousSha256, evidence.id);
		file.sha256 = pin.currentSha256;
		actualPinCounts.set(pin.path, actualPinCounts.get(pin.path) + 1);
	}
for(const pin of inheritedCheckedRecordPerlPinRepairPins)
	assert.equal(actualPinCounts.get(pin.path), pin.count, pin.path);
const pinCount = inheritedCheckedRecordPerlPinRepairPins.reduce(
	(total, pin) => total + pin.count, 0
);
assert.ok(pinCount > 0, "Inherited Perl repair must refresh stale pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
const liveInventory = await readFile(inventoryPath, "utf8");
const draftInventoryUpdate = draft?.updates?.find(
	update => update.path === inventoryPath
);
const liveInventoryPrevious = draftInventoryUpdate
	&& sha256(liveInventory) === draftInventoryUpdate.currentSha256
	? reverseInheritedCheckedRecordPerlPinRepairUpdate(
		liveInventory, draftInventoryUpdate
	) : liveInventory;
assert.ok(liveInventoryPrevious === inventoryPrevious
	|| liveInventory === inventoryCurrent
, "Type-surface inventory must be the exact predecessor or generated repair");
const expectedModifiedPaths = liveInventory === inventoryPrevious
	? sourcePaths : inheritedCheckedRecordPerlPinRepairChangedPaths;
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, inheritedCheckedRecordPerlPinRepairPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...expectedModifiedPaths].sort());

const sources = new Map([[inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
}]]);
for(const path of sourcePaths)
{
	const previous = git(["show"
		, `${inheritedCheckedRecordPerlPinRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of inheritedCheckedRecordPerlPinRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${inheritedCheckedRecordPerlPinRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	const current = await readFile(path);
	additions.push({ path, currentSha256: sha256(current) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-inherited-record-perl-pin-repair-history-"
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
	for(const path of inheritedCheckedRecordPerlPinRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
		};
		if(path === inventoryPath) update.replacements
			= inheritedCheckedRecordPerlPinRepairPins.map(pin => ({
				previous: pin.previousSha256, current: pin.currentSha256
				, count: pin.count
			}));
		else update.edits = await edits(source.previous, source.current);
		assert.equal(reverseInheritedCheckedRecordPerlPinRepairUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const pinUpdates = inheritedCheckedRecordPerlPinRepairPins.map(pin => ({
		...pin
	}));
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "inherited-checked-record-perl-pin-repair-source-v1"
		, predecessorCommit: inheritedCheckedRecordPerlPinRepairPredecessor
		, draftParentCommit: inheritedCheckedRecordPerlPinRepairDraftParent
		, pathsSha256: sha256(JSON.stringify(
			inheritedCheckedRecordPerlPinRepairChangedPaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(inheritedCheckedRecordPerlPinRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} transitions, ${additions.length} additions and refreshed ${pinCount} pins.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
