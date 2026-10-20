#!/usr/bin/env node
/**
 * Record the final value-index matrix evidence-pin repair and wiring.
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
	checkedRecordValueIndexMatrixEvidencePinRepairAddedPaths
	, checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths
	, checkedRecordValueIndexMatrixEvidencePinRepairDraftParent
	, checkedRecordValueIndexMatrixEvidencePinRepairHistoryPath
	, checkedRecordValueIndexMatrixEvidencePinRepairPins
	, checkedRecordValueIndexMatrixEvidencePinRepairPredecessor
	, reverseCheckedRecordValueIndexMatrixEvidencePinRepairUpdate
} from "../tests/helpers/checked-record-value-index-matrix-evidence-pin-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const sourcePaths = checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths
	.filter(path => path !== inventoryPath);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexMatrixEvidencePinRepairDraftParent
	, "Value-index matrix evidence-pin history must stay on its exact draft parent");
assert.equal(checkedRecordValueIndexMatrixEvidencePinRepairPredecessor
	, checkedRecordValueIndexMatrixEvidencePinRepairDraftParent);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexMatrixEvidencePinRepairDraftParent}:${checkedRecordValueIndexMatrixEvidencePinRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0
, "Never rewrite committed value-index matrix evidence-pin history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"
	, ...sourcePaths]), [...sourcePaths].sort());
assert.deepEqual([...new Set([
	...names(["ls-files", "--others", "--exclude-standard", "--"
		, ...checkedRecordValueIndexMatrixEvidencePinRepairAddedPaths])
	, ...names(["diff", "--cached", "--name-only", "--diff-filter=A", "--"
		, ...checkedRecordValueIndexMatrixEvidencePinRepairAddedPaths])
])].sort(), [...checkedRecordValueIndexMatrixEvidencePinRepairAddedPaths].sort());

const inventoryPrevious = git(["show"
	, `${checkedRecordValueIndexMatrixEvidencePinRepairPredecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinsByPath = new Map(checkedRecordValueIndexMatrixEvidencePinRepairPins
	.map(pin => [pin.path, pin]));
const actualCounts = new Map(checkedRecordValueIndexMatrixEvidencePinRepairPins
	.map(pin => [pin.path, 0]));
for(const pin of checkedRecordValueIndexMatrixEvidencePinRepairPins)
	assert.equal(sha256(await readFile(pin.path)), pin.currentSha256, pin.path);
for(const evidence of inventory.evidence) for(const file of evidence.files)
	if(pinsByPath.has(file.path))
	{
		const pin = pinsByPath.get(file.path);
		assert.equal(file.sha256, pin.previousSha256, evidence.id);
		file.sha256 = pin.currentSha256;
		actualCounts.set(pin.path, actualCounts.get(pin.path) + 1);
	}
for(const pin of checkedRecordValueIndexMatrixEvidencePinRepairPins)
	assert.equal(actualCounts.get(pin.path), pin.count, pin.path);
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";

const sources = new Map([[inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
}]]);
for(const path of sourcePaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexMatrixEvidencePinRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexMatrixEvidencePinRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexMatrixEvidencePinRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-matrix-evidence-pin-history-"
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
	for(const path of checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
		};
		if(path === inventoryPath) update.replacements
			= checkedRecordValueIndexMatrixEvidencePinRepairPins.map(pin => ({
				previous: pin.previousSha256, current: pin.currentSha256
				, count: pin.count
			}));
		else update.edits = await edits(source.previous, source.current);
		assert.equal(reverseCheckedRecordValueIndexMatrixEvidencePinRepairUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const pinCount = checkedRecordValueIndexMatrixEvidencePinRepairPins.reduce(
		(total, pin) => total + pin.count, 0
	);
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(checkedRecordValueIndexMatrixEvidencePinRepairHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone:
				"checked-record-value-index-matrix-evidence-pin-repair-source-v1"
			, predecessorCommit:
				checkedRecordValueIndexMatrixEvidencePinRepairPredecessor
			, draftParentCommit:
				checkedRecordValueIndexMatrixEvidencePinRepairDraftParent
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths
			))
			, pinCount
			, pinUpdates: checkedRecordValueIndexMatrixEvidencePinRepairPins
			, additions, updates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} evidence-pin transitions, ${additions.length} additions and ${pinCount} refreshed pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
