#!/usr/bin/env node
/**
 * Record the current-source ordering repair without changing older evidence.
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
	reverseValueIndexNativeBindingIrOrderingRepairUpdate
	, valueIndexNativeBindingIrOrderingRepairAddedPaths
	, valueIndexNativeBindingIrOrderingRepairChangedPaths
	, valueIndexNativeBindingIrOrderingRepairHistoryPath
	, valueIndexNativeBindingIrOrderingRepairPredecessor
} from "../tests/helpers/value-index-native-binding-ir-ordering-repair-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const split = value => value.trim().split("\n").filter(Boolean).sort();

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, valueIndexNativeBindingIrOrderingRepairPredecessor
	, "Ordering repair must stay on its exact predecessor");
assert.equal(git(["ls-tree", "--name-only"
	, valueIndexNativeBindingIrOrderingRepairPredecessor, "--"
	, valueIndexNativeBindingIrOrderingRepairHistoryPath]).trim(), ""
, "Never rewrite committed ordering-repair history");
assert.deepEqual(split(git(["diff", "--name-only", "--diff-filter=M"]))
	, [...valueIndexNativeBindingIrOrderingRepairChangedPaths].sort());
assert.deepEqual(split(git(["ls-files", "--others", "--exclude-standard", "--"
	, "docs/evidence", "scripts", "tests"])).filter(path =>
	path !== valueIndexNativeBindingIrOrderingRepairHistoryPath)
, [...valueIndexNativeBindingIrOrderingRepairAddedPaths].sort());
const draft = await readFile(valueIndexNativeBindingIrOrderingRepairHistoryPath, "utf8")
	.then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "value-index-native-binding-ir-ordering-repair-v1");
	assert.equal(draft.predecessorCommit
		, valueIndexNativeBindingIrOrderingRepairPredecessor);
}

const sources = new Map();
for(const path of valueIndexNativeBindingIrOrderingRepairChangedPaths)
{
	const previous = git(["show"
		, `${valueIndexNativeBindingIrOrderingRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of valueIndexNativeBindingIrOrderingRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${valueIndexNativeBindingIrOrderingRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-binding-ir-ordering-"));
try
{
	const edits = async (previous, current) => {
		const before = join(root, "before"), after = join(root, "after");
		await writeFile(before, previous); await writeFile(after, current);
		let diff;
		try
		{ diff = execFileSync("diff", ["--speed-large-files", "--unified=0", before, after], { encoding: "utf8" }); }
		catch(error)
		{ if(error.status !== 1) throw error; diff = error.stdout; }
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const matches = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)];
		assert.ok(matches.length > 0);
		return matches.map(match => {
			const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return { start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
		});
	};
	const updates = [];
	for(const path of valueIndexNativeBindingIrOrderingRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = { path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current) };
		assert.equal(reverseValueIndexNativeBindingIrOrderingRepairUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({ schemaVersion: 1
		, milestone: "value-index-native-binding-ir-ordering-repair-v1"
		, predecessorCommit: valueIndexNativeBindingIrOrderingRepairPredecessor
		, pathsSha256: sha256(JSON.stringify(
			valueIndexNativeBindingIrOrderingRepairChangedPaths
		))
		, additions, updates }, null, 2) + "\n";
	await writeFile(valueIndexNativeBindingIrOrderingRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} ordering transitions and ${additions.length} additions.\n`);
}
finally
{ await rm(root, { recursive: true, force: true }); }
