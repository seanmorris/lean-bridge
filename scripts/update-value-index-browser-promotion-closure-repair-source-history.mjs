#!/usr/bin/env node
/**
 * Record the value-index browser promotion closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	reverseValueIndexBrowserPromotionClosureRepairUpdate
	, valueIndexBrowserPromotionClosureRepairAddedPaths
	, valueIndexBrowserPromotionClosureRepairChangedPaths
	, valueIndexBrowserPromotionClosureRepairHistoryPath
	, valueIndexBrowserPromotionClosureRepairImplementation
	, valueIndexBrowserPromotionClosureRepairIntegrationPaths
	, valueIndexBrowserPromotionClosureRepairPredecessor
} from "../tests/helpers/value-index-browser-promotion-closure-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = valueIndexBrowserPromotionClosureRepairImplementation;
const predecessor = valueIndexBrowserPromotionClosureRepairPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Closure repair history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...valueIndexBrowserPromotionClosureRepairChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, valueIndexBrowserPromotionClosureRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-value-index-browser-closure-history-"
));
const diffEdits = async (previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = lines => {
		const result = [0];
		for(const line of lines) result.push(result.at(-1) + line.length);
		return result;
	};
	const currentOffsets = offsets(currentLines);
	return [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentOffsets[currentStart]
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
};
const transition = async (path, previous, current) => {
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits: await diffEdits(previous, current)
	};
	assert.ok(update.edits.length > 0, path);
	assert.equal(reverseValueIndexBrowserPromotionClosureRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of valueIndexBrowserPromotionClosureRepairChangedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of valueIndexBrowserPromotionClosureRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of valueIndexBrowserPromotionClosureRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(valueIndexBrowserPromotionClosureRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "value-index-browser-promotion-closure-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "The historical browser value-index promotion reconstructs every originally added source at its authenticated milestone before checking closure, so later reversible repairs do not invalidate the original promotion evidence."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
