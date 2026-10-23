#!/usr/bin/env node
/**
 * Record the two omitted tests/test-profiles.test.mjs transitions from exact
 * Git blobs, plus this repair's own registration and hub integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	reverseTestProfilesRegistrationGapHistoricalUpdate
	, reverseTestProfilesRegistrationGapUpdate
	, testProfilesRegistrationGapAddedPaths
	, testProfilesRegistrationGapHistoryPath
	, testProfilesRegistrationGapIntegrationPaths
	, testProfilesRegistrationGapPredecessor
	, testProfilesRegistrationGapTransitions
} from "../tests/helpers/test-profiles-registration-gap-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, testProfilesRegistrationGapPredecessor
	, "Test-profile registration gap history requires its exact predecessor commit");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"])
	, [...testProfilesRegistrationGapIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...testProfilesRegistrationGapAddedPaths])
, [...testProfilesRegistrationGapAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-test-profiles-registration-gap-history-"));
const transition = async (path, previous, current, reverse) => {
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
	assert.equal(reverse(current, update), previous, path);
	return update;
};

try
{
	const historicalTransitions = [];
	for(const item of testProfilesRegistrationGapTransitions)
		historicalTransitions.push({
			previousCommit: item.previousCommit, currentCommit: item.currentCommit
			, ...await transition(item.path
				, git(["show", `${item.previousCommit}:${item.path}`])
				, git(["show", `${item.currentCommit}:${item.path}`])
				, reverseTestProfilesRegistrationGapHistoricalUpdate)
		});
	for(let index = 0; index < historicalTransitions.length - 1; index++)
		assert.equal(historicalTransitions[index].previousSha256
			, historicalTransitions[index + 1].currentSha256);
	const integrationUpdates = [];
	for(const path of testProfilesRegistrationGapIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${testProfilesRegistrationGapPredecessor}:${path}`])
			, await readFile(path, "utf8"), reverseTestProfilesRegistrationGapUpdate));
	const additions = [];
	for(const path of testProfilesRegistrationGapAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${testProfilesRegistrationGapPredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(testProfilesRegistrationGapHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "test-profiles-registration-gap-v1"
		, predecessorCommit: testProfilesRegistrationGapPredecessor
		, scope: "Record the two 2026-10-19 tests/test-profiles.test.mjs transitions (b51d6f6 -> c8f51db -> 656a415) that no history layer recorded, so the 2026-10-06 test-profile registration milestone is reachable again, plus this repair's own registration and hub integration."
		, historicalTransitions, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${historicalTransitions.length} historical and ${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
