#!/usr/bin/env node
/**
 * Record the value-index browser fixture lint repair and refresh only matching
 * live source pins.
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
	reverseValueIndexBrowserLintUpdate, valueIndexBrowserLintAddedPaths
	, valueIndexBrowserLintChangedPaths, valueIndexBrowserLintDraftParent
	, valueIndexBrowserLintHistoryPath, valueIndexBrowserLintPredecessor
} from "../tests/helpers/value-index-browser-lint-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const foundationModifiedPaths = Object.freeze([
	"tests/fixtures/checked-record-value-index-browser/full.mts"
	, "tests/fixtures/checked-record-value-index-browser/result-only.mts"
]);
const implementationPaths = valueIndexBrowserLintChangedPaths.filter(path =>
	path !== inventoryPath);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, valueIndexBrowserLintDraftParent
	, "Value-index browser lint history must stay on its exact repair commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, valueIndexBrowserLintPredecessor
	, "Value-index browser lint repair must have its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", valueIndexBrowserLintDraftParent
	, "--", valueIndexBrowserLintHistoryPath]).trim(), ""
, "Never rewrite committed value-index browser lint history");
const draft = await readFile(valueIndexBrowserLintHistoryPath, "utf8")
	.then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "value-index-browser-lint-source-v1");
	assert.equal(draft.predecessorCommit, valueIndexBrowserLintPredecessor);
	assert.equal(draft.draftParentCommit, valueIndexBrowserLintDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, valueIndexBrowserLintPredecessor, valueIndexBrowserLintDraftParent])
	.trim().split("\n").filter(Boolean).sort()
, [...foundationModifiedPaths].sort());
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=A"
	, valueIndexBrowserLintPredecessor, valueIndexBrowserLintDraftParent])
	.trim().split("\n").filter(Boolean), []);
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...valueIndexBrowserLintAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...valueIndexBrowserLintAddedPaths].sort());

const sources = new Map();
for(const path of implementationPaths)
{
	const previous = git(["show", `${valueIndexBrowserLintPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of valueIndexBrowserLintAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${valueIndexBrowserLintPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${valueIndexBrowserLintPredecessor}:${inventoryPath}`]);
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
assert.equal(pinCount, 3
	, "Value-index browser lint repair must refresh three live source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, { previous: inventoryPrevious
	, current: inventoryCurrent });

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-browser-lint-history-"
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
	for(const path of valueIndexBrowserLintChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseValueIndexBrowserLintUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1, milestone: "value-index-browser-lint-source-v1"
		, predecessorCommit: valueIndexBrowserLintPredecessor
		, draftParentCommit: valueIndexBrowserLintDraftParent
		, pathsSha256: sha256(JSON.stringify(
			valueIndexBrowserLintChangedPaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(valueIndexBrowserLintHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} value-index browser lint transitions, ${additions.length} additions and ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
