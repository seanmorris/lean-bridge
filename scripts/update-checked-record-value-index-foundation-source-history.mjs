#!/usr/bin/env node
/**
 * Record closed checked-record value-index admission and refresh only the
 * source pins that name its changed implementation and documentation.
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
	checkedRecordValueIndexFoundationAddedPaths
	, checkedRecordValueIndexFoundationChangedPaths
	, checkedRecordValueIndexFoundationDraftParent
	, checkedRecordValueIndexFoundationHistoryPath
	, checkedRecordValueIndexFoundationPredecessor
	, reverseCheckedRecordValueIndexFoundationUpdate
} from "../tests/helpers/checked-record-value-index-foundation-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const implementationPaths = checkedRecordValueIndexFoundationChangedPaths
	.filter(path => path !== inventoryPath);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexFoundationDraftParent
	, "Value-index history must stay on its exact foundation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexFoundationPredecessor
	, "Value-index foundation must have its exact predecessor");
assert.equal(git(["ls-tree", "--name-only"
	, checkedRecordValueIndexFoundationDraftParent, "--"
	, checkedRecordValueIndexFoundationHistoryPath]).trim(), ""
, "Never rewrite committed value-index foundation history");
const draft = await readFile(
	checkedRecordValueIndexFoundationHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-foundation-source-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexFoundationPredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexFoundationDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexFoundationPredecessor, "--"])
	.trim().split("\n").filter(path => path && path !== inventoryPath).sort()
, [...implementationPaths].sort());
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, "docs/evidence", "scripts", "tests"])
	.trim().split("\n").filter(path => path
		&& path !== checkedRecordValueIndexFoundationHistoryPath).sort()
, [...checkedRecordValueIndexFoundationAddedPaths].sort());

const sources = new Map();
for(const path of implementationPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexFoundationPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexFoundationAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexFoundationPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${checkedRecordValueIndexFoundationPredecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const path of implementationPaths)
{
	const source = sources.get(path);
	const previousSha256 = sha256(source.previous);
	const currentSha256 = sha256(source.current);
	let count = 0;
	for(const evidence of inventory.evidence) for(const file of evidence.files)
		if(file.path === path && file.sha256 === previousSha256)
		{
			file.sha256 = currentSha256;
			count++;
		}
	if(count)
	{
		pinCount += count;
		pinUpdates.push({ path, previousSha256, currentSha256, count });
	}
}
assert.equal(pinCount, 384
	, "Value-index admission must refresh exactly 384 live source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-checked-record-value-index-history-"
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
			if(error.status !== 1 || typeof error.stdout !== "string")
				throw error;
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
	for(const path of checkedRecordValueIndexFoundationChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCheckedRecordValueIndexFoundationUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-record-value-index-foundation-source-v1"
		, predecessorCommit: checkedRecordValueIndexFoundationPredecessor
		, draftParentCommit: checkedRecordValueIndexFoundationDraftParent
		, pathsSha256: sha256(JSON.stringify(
			checkedRecordValueIndexFoundationChangedPaths
		))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(checkedRecordValueIndexFoundationHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} value-index transitions, ${additions.length} additions and ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
