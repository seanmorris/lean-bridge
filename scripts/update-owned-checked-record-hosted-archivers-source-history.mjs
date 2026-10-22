#!/usr/bin/env node
/**
 * Record the owned checked-record hosted archiver transition.
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
	ownedCheckedRecordHostedArchiversAddedPaths
	, ownedCheckedRecordHostedArchiversHistoricalAdditions
	, ownedCheckedRecordHostedArchiversHistoryPath
	, ownedCheckedRecordHostedArchiversHistoryParent
	, ownedCheckedRecordHostedArchiversImplementation
	, ownedCheckedRecordHostedArchiversImplementationPaths
	, ownedCheckedRecordHostedArchiversIntegrationBase
	, ownedCheckedRecordHostedArchiversIntegrationPredecessor
	, ownedCheckedRecordHostedArchiversIntegrationPaths
	, ownedCheckedRecordHostedArchiversModifiedPaths
	, ownedCheckedRecordHostedArchiversPredecessor
	, reverseOwnedCheckedRecordHostedArchiversUpdate
} from "../tests/helpers/owned-checked-record-hosted-archivers-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordHostedArchiversHistoryParent
	, "Owned checked-record hosted archiver history requires its exact integration parent");
assert.equal(git(["rev-parse"
	, `${ownedCheckedRecordHostedArchiversImplementation}^`]).trim()
, ownedCheckedRecordHostedArchiversPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, ownedCheckedRecordHostedArchiversPredecessor
	, ownedCheckedRecordHostedArchiversImplementation]).trim().split("\n").sort()
, [...ownedCheckedRecordHostedArchiversImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedRecordHostedArchiversHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-owned-checked-record-hosted-archivers-history-"));
const transitionSources = async (path, previous, current) => {
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
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current), edits
	};
	assert.equal(reverseOwnedCheckedRecordHostedArchiversUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const historicalUpdates = [];
	for(const path of ownedCheckedRecordHostedArchiversModifiedPaths)
		historicalUpdates.push(await transitionSources(path
			, git(["show", `${ownedCheckedRecordHostedArchiversPredecessor}:${path}`])
			, git(["show", `${ownedCheckedRecordHostedArchiversImplementation}:${path}`])));
	const historicalAdditions = [];
	for(const path of ownedCheckedRecordHostedArchiversHistoricalAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordHostedArchiversPredecessor, "--", path]).trim()
		, "", path);
		historicalAdditions.push({
			path
			, currentSha256: sha256(git(["show"
				, `${ownedCheckedRecordHostedArchiversImplementation}:${path}`]))
		});
	}
	const integrationUpdates = [];
	for(const path of ownedCheckedRecordHostedArchiversIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show"
				, `${ownedCheckedRecordHostedArchiversIntegrationBase(path)}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedRecordHostedArchiversAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordHostedArchiversHistoryParent, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedCheckedRecordHostedArchiversHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-checked-record-hosted-archivers-v1"
			, predecessorCommit: ownedCheckedRecordHostedArchiversPredecessor
			, implementationCommit: ownedCheckedRecordHostedArchiversImplementation
			, integrationPredecessorCommit: ownedCheckedRecordHostedArchiversIntegrationPredecessor
			, historyParentCommit: ownedCheckedRecordHostedArchiversHistoryParent
			, scope: "Add fail-closed hosted archivers and independent verifiers for the nine non-PHP-Wasm owned checked-record lanes, binding API records, TAP, canonical reports, consumer sources and every retained original package byte."
			, historicalAdditions, historicalUpdates
			, additions, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${historicalUpdates.length} historical and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
