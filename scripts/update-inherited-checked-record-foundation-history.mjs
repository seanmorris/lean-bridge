#!/usr/bin/env node
/**
 * Record inherited checked-record compiler admission and refresh only the
 * source pins that name the changed implementation.
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
	inheritedCheckedRecordFoundationAddedPaths
	, inheritedCheckedRecordFoundationChangedPaths
	, inheritedCheckedRecordFoundationHistoryPath
	, inheritedCheckedRecordFoundationPredecessor
} from "../tests/helpers/inherited-checked-record-foundation-history.mjs";

const predecessor = inheritedCheckedRecordFoundationPredecessor;
const historyPath = inheritedCheckedRecordFoundationHistoryPath;
const inventoryPath = "docs/type-surface.v1.json";
const sourcePaths = [...inheritedCheckedRecordFoundationChangedPaths];
const implementationPaths = sourcePaths.filter(path => path !== inventoryPath);
const additionPaths = [...inheritedCheckedRecordFoundationAddedPaths];
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.deepEqual(sourcePaths, [...sourcePaths].sort());
assert.deepEqual(additionPaths, [...additionPaths].sort());
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor
	, "Inherited checked-record history must stay on its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", historyPath]).trim(), ""
	, "Never rewrite a committed inherited checked-record ledger");
const draft = await readFile(historyPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "inherited-checked-record-foundation-source-v1");
	assert.equal(draft.predecessorCommit, predecessor);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"])
	.trim().split("\n").filter(path => path && path !== inventoryPath).sort()
, implementationPaths);
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, "docs/evidence", "scripts", "tests"])
	.trim().split("\n").filter(path => path && path !== historyPath).sort()
, additionPaths);

const sources = new Map();
for(const path of implementationPaths)
{
	const previous = git(["show", `${predecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of additionPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${predecessor}:${path}`], { stdio: "ignore" }).status, 0);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show", `${predecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const path of implementationPaths)
{
	const source = sources.get(path);
	const previousSha256 = sha256(source.previous);
	const currentSha256 = sha256(source.current);
	let count = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
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
assert.equal(pinCount, 496
	, "Inherited checked-record admission must refresh exactly 496 live pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-inherited-checked-record-foundation-"
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
	for(const path of sourcePaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
		};
		if(path === inventoryPath) update.replacements = pinUpdates.map(pin => ({
			previous: pin.previousSha256, current: pin.currentSha256
			, count: pin.count
		}));
		else update.edits = await edits(source.previous, source.current);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "inherited-checked-record-foundation-source-v1"
		, predecessorCommit: predecessor
		, pathsSha256: sha256(JSON.stringify(sourcePaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(historyPath, record, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} transitions, ${additions.length} additions and refreshed ${pinCount} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
