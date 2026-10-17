#!/usr/bin/env node
/**
 * Record the omitted recursive Perl package transition and the exact repair
 * that makes it reachable from the current source-history chain.
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
	recursiveCheckedRecordPerlPackageHistoricalCommit
	, recursiveCheckedRecordPerlPackageHistoricalParent
	, recursiveCheckedRecordPerlPackageHistoricalPaths
	, recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths
	, recursiveCheckedRecordPerlPackageHistoryRepairPath
	, recursiveCheckedRecordPerlPackageHistoryRepairPredecessor
	, reverseRecursiveCheckedRecordPerlPackageHistoricalUpdate
	, reverseRecursiveCheckedRecordPerlPackageHistoryRepairUpdate
} from "../tests/helpers/recursive-checked-record-perl-package-history-repair.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, recursiveCheckedRecordPerlPackageHistoryRepairPredecessor
	, "Recursive Perl package history repair is draft-only at its exact parent");
const historicalParent = git(["rev-parse"
	, `${recursiveCheckedRecordPerlPackageHistoricalCommit}^`]).trim();
assert.equal(historicalParent, recursiveCheckedRecordPerlPackageHistoricalParent
	, "Historical Perl package transition must retain its exact parent");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--"
	, recursiveCheckedRecordPerlPackageHistoryRepairPath]).trim()
, "Never rewrite a committed recursive Perl package history repair ledger");

const inventoryPath = "docs/type-surface.v1.json";
const inventoryBefore = git(["show"
	, `${recursiveCheckedRecordPerlPackageHistoryRepairPredecessor}:${inventoryPath}`]);
const draft = await readFile(
	recursiveCheckedRecordPerlPackageHistoryRepairPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.predecessorCommit
		, recursiveCheckedRecordPerlPackageHistoryRepairPredecessor);
	assert.equal(draft.historicalCommit
		, recursiveCheckedRecordPerlPackageHistoricalCommit);
	assert.equal(draft.historicalParent
		, recursiveCheckedRecordPerlPackageHistoricalParent);
}
const currentInventory = await readFile(inventoryPath, "utf8");
const draftInventory = draft?.updates.find(item => item.path === inventoryPath);
const restoredInventory = draftInventory?.currentSha256 === sha256(currentInventory)
	? reverseRecursiveCheckedRecordPerlPackageHistoryRepairUpdate(
		currentInventory, draftInventory
	) : currentInventory;
assert.equal(restoredInventory, inventoryBefore
	, "Never overwrite unrecorded type-surface changes");

const currentSources = new Map();
for(const path of recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths)
{
	if(path === inventoryPath) continue;
	const previous = git(["show"
		, `${recursiveCheckedRecordPerlPackageHistoryRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	currentSources.set(path, { previous, current });
}

const inventory = JSON.parse(inventoryBefore);
let pinCount = 0;
for(const entry of inventory.evidence) for(const file of entry.files)
{
	const source = currentSources.get(file.path);
	if(source && file.sha256 === sha256(source.previous))
	{
		file.sha256 = sha256(source.current);
		pinCount++;
	}
}
assert.ok(pinCount > 0
	, "Recursive Perl package history repair must refresh current-source pins");
const inventoryAfter = JSON.stringify(inventory, null, 2) + "\n";
currentSources.set(inventoryPath, {
	previous: inventoryBefore, current: inventoryAfter
});

const historicalSources = new Map();
for(const path of recursiveCheckedRecordPerlPackageHistoricalPaths)
{
	const previous = git(["show"
		, `${recursiveCheckedRecordPerlPackageHistoricalParent}:${path}`]);
	const current = git(["show"
		, `${recursiveCheckedRecordPerlPackageHistoricalCommit}:${path}`]);
	assert.notEqual(current, previous, path);
	historicalSources.set(path, { previous, current });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-recursive-perl-package-history-repair-"
));
try
{
	const transition = async (path, sources, reverse) => {
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
		assert.equal(reverse(current, update), previous);
		return update;
	};
	const updates = [];
	for(const path of recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths)
		updates.push(await transition(path, currentSources
			, reverseRecursiveCheckedRecordPerlPackageHistoryRepairUpdate));
	const historicalUpdates = [];
	for(const path of recursiveCheckedRecordPerlPackageHistoricalPaths)
		historicalUpdates.push(await transition(path, historicalSources
			, reverseRecursiveCheckedRecordPerlPackageHistoricalUpdate));
	await writeFile(inventoryPath, inventoryAfter);
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "recursive-checked-record-perl-package-history-repair-v1"
		, predecessorCommit:
			recursiveCheckedRecordPerlPackageHistoryRepairPredecessor
		, historicalCommit: recursiveCheckedRecordPerlPackageHistoricalCommit
		, historicalParent: recursiveCheckedRecordPerlPackageHistoricalParent
		, pinCount, historicalUpdates, updates
	}, null, 2) + "\n";
	await writeFile(recursiveCheckedRecordPerlPackageHistoryRepairPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${historicalUpdates.length} omitted historical transitions, ${updates.length} repair transitions and refreshed ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
