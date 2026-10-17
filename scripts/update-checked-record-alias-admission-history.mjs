#!/usr/bin/env node
/**
 * Record the checked-record alias admission repair without changing any
 * earlier source-history ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";

const predecessor = "2d68d17d7c5e9ff2d87d972d7a16d4e4d9f413cc";
const repairCommit = "a1b4f5c2246313cbe2905d3bc9c381b4f6af984f";
const historyPath
	= "docs/evidence/checked-record-alias-admission-source-history-20261017.json";
const inventoryPath = "docs/type-surface.v1.json";
const sourcePaths = [
	"src/adoption/test-profiles.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
].sort();
const additionPaths = [
	"scripts/update-checked-record-alias-admission-history.mjs"
	, "tests/checked-record-alias-admission-source-history.test.mjs"
	, "tests/helpers/checked-record-alias-admission-source-history.mjs"
].sort();
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim(), repairCommit
	, "Alias admission history must stay on its exact repair commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor
	, "Alias admission repair must have its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", predecessor, "--", historyPath]).trim(), ""
	, "Never rewrite a committed alias-admission ledger");
const draft = await readFile(historyPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "checked-record-alias-admission-source-v1");
	assert.equal(draft.predecessorCommit, predecessor);
	assert.equal(draft.repairCommit, repairCommit);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, predecessor, "--"]).trim().split("\n").filter(Boolean).sort(), sourcePaths);

const sources = new Map();
for(const path of sourcePaths)
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
	const current = await readFile(path);
	additions.push({ path, currentSha256: sha256(current) });
}

const inventoryPrevious = git(["show", `${predecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const [path, source] of sources)
{
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
assert.ok(pinCount > 0, "Alias admission must refresh live source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-checked-record-alias-admission-"
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
	const paths = [inventoryPath, ...sourcePaths].sort();
	const updates = [];
	for(const path of paths)
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
	const pathsSha256 = sha256(JSON.stringify(paths));
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-record-alias-admission-source-v1"
		, predecessorCommit: predecessor, repairCommit, pathsSha256
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
