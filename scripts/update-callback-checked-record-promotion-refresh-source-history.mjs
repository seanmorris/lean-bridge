#!/usr/bin/env node
/**
 * Record the retained callback checked-record promotion refresh.
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
	callbackCheckedRecordPromotionRefreshAddedPaths
	, callbackCheckedRecordPromotionRefreshApplicationAddedPaths
	, callbackCheckedRecordPromotionRefreshChangedPaths
	, callbackCheckedRecordPromotionRefreshHistoryPath
	, callbackCheckedRecordPromotionRefreshImplementation
	, callbackCheckedRecordPromotionRefreshIntegrationPaths
	, callbackCheckedRecordPromotionRefreshPredecessor
	, reverseCallbackCheckedRecordPromotionRefreshUpdate
} from "../tests/helpers/callback-checked-record-promotion-refresh-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = callbackCheckedRecordPromotionRefreshImplementation;
const predecessor = callbackCheckedRecordPromotionRefreshPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Callback checked-record promotion refresh history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...callbackCheckedRecordPromotionRefreshChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...callbackCheckedRecordPromotionRefreshApplicationAddedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackCheckedRecordPromotionRefreshHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-callback-record-promotion-refresh-history-"));
const transition = async (path, previous, current) => {
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
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.equal(reverseCallbackCheckedRecordPromotionRefreshUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackCheckedRecordPromotionRefreshChangedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of callbackCheckedRecordPromotionRefreshIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackCheckedRecordPromotionRefreshAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackCheckedRecordPromotionRefreshHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-checked-record-promotion-refresh-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "The synchronous checked-record matrix retains its 64 promoted cells while all eight evidence records and consumer links advance to independently replayed archives with explicit producer, checker and archiver identities."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
