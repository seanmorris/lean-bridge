#!/usr/bin/env node
/**
 * Record the focused primitive-audit Core repairs without rewriting an older
 * immutable source-history ledger or changing any support claim.
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
	primitiveAuditCoreRepairAddedPaths
	, primitiveAuditCoreRepairChangedPaths
	, primitiveAuditCoreRepairDraftParent
	, primitiveAuditCoreRepairExpectedPinCount
	, primitiveAuditCoreRepairHistoricalPaths
	, primitiveAuditCoreRepairHistoryPath
	, primitiveAuditCoreRepairPredecessor
	, primitiveAuditCoreRepairProfilePredecessor
	, reversePrimitiveAuditCoreRepairUpdate
} from "../tests/helpers/primitive-audit-core-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const sourcePaths = primitiveAuditCoreRepairChangedPaths
	.filter(path => path !== inventoryPath);
const worktreePaths = sourcePaths.filter(path =>
	!primitiveAuditCoreRepairHistoricalPaths.includes(path));
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, primitiveAuditCoreRepairDraftParent
	, "Primitive audit Core repair history must stay on its exact draft parent");
assert.equal(primitiveAuditCoreRepairPredecessor
	, primitiveAuditCoreRepairDraftParent);
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, primitiveAuditCoreRepairProfilePredecessor
	, primitiveAuditCoreRepairPredecessor]).status, 0
, "Supplement profile predecessor must remain an ancestor");
assert.equal(git(["ls-tree", "--name-only"
	, primitiveAuditCoreRepairDraftParent, "--"
	, primitiveAuditCoreRepairHistoryPath]).trim(), ""
, "Never rewrite a committed primitive audit Core repair ledger");
const draft = await readFile(
	primitiveAuditCoreRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "primitive-audit-core-repair-source-v1");
	assert.equal(draft.predecessorCommit
		, primitiveAuditCoreRepairPredecessor);
	assert.equal(draft.draftParentCommit
		, primitiveAuditCoreRepairDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, primitiveAuditCoreRepairPredecessor, "--"])
	.trim().split("\n").filter(path => path && path !== inventoryPath).sort()
, [...worktreePaths].sort());

const sources = new Map();
for(const path of sourcePaths)
{
	const historical = primitiveAuditCoreRepairHistoricalPaths.includes(path);
	const predecessorCommit = historical
		? primitiveAuditCoreRepairProfilePredecessor
		: primitiveAuditCoreRepairPredecessor;
	const previous = git(["show", `${predecessorCommit}:${path}`]);
	const current = historical
		? git(["show", `${primitiveAuditCoreRepairPredecessor}:${path}`])
		: await readFile(path, "utf8");
	if(historical) assert.equal(await readFile(path, "utf8"), current, path);
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current, predecessorCommit });
}
const additions = [];
for(const path of primitiveAuditCoreRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${primitiveAuditCoreRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${primitiveAuditCoreRepairPredecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const [path, source] of sources)
{
	const previousSha256 = sha256(source.previous);
	const currentSha256 = sha256(source.current);
	let count = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
		if(file.path === path)
		{
			assert.equal(file.sha256, previousSha256
				, `${path}: unexpected source-pin predecessor`);
			file.sha256 = currentSha256;
			count++;
		}
	if(count)
	{
		pinCount += count;
		pinUpdates.push({
			path, previous: previousSha256, current: currentSha256, count
		});
	}
}
assert.equal(pinCount, primitiveAuditCoreRepairExpectedPinCount);
assert.equal(pinUpdates.length, 7);
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
for(const pin of pinUpdates)
{
	assert.equal(inventoryPrevious.split(pin.previous).length - 1, pin.count
		, `${pin.path}: previous pin count`);
	assert.equal(inventoryCurrent.split(pin.current).length - 1, pin.count
		, `${pin.path}: current pin count`);
}
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
	, predecessorCommit: primitiveAuditCoreRepairPredecessor
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-primitive-audit-core-repair-history-"
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
	for(const path of primitiveAuditCoreRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
		};
		if(source.predecessorCommit !== primitiveAuditCoreRepairPredecessor)
			update.predecessorCommit = source.predecessorCommit;
		if(path === inventoryPath)
			update.replacements = pinUpdates.map(({
				previous, current, count
			}) => ({ previous, current, count }));
		else update.edits = await edits(source.previous, source.current);
		assert.equal(reversePrimitiveAuditCoreRepairUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const pathsSha256 = sha256(JSON.stringify(
		primitiveAuditCoreRepairChangedPaths
	));
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "primitive-audit-core-repair-source-v1"
		, predecessorCommit: primitiveAuditCoreRepairPredecessor
		, draftParentCommit: primitiveAuditCoreRepairDraftParent
		, profilePredecessorCommit: primitiveAuditCoreRepairProfilePredecessor
		, pathsSha256, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(primitiveAuditCoreRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} transitions, ${additions.length} additions and refreshed ${pinCount} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
