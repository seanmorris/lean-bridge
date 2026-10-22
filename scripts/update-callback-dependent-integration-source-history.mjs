#!/usr/bin/env node
/**
 * Record an exact two-parent reconciliation for the callback checked-record
 * and dependent checked-record archive histories.
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
	callbackDependentIntegrationAddedPaths
	, callbackDependentIntegrationChangedPaths
	, callbackDependentIntegrationCommit
	, callbackDependentIntegrationHistoryPath
	, callbackDependentIntegrationLeftParent
	, callbackDependentIntegrationRightParent
	, reverseCallbackDependentIntegrationUpdate
} from "../tests/helpers/callback-dependent-integration-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackDependentIntegrationCommit
	, "Callback/dependent history is draft-only at its integration commit");
assert.deepEqual(git(["show", "-s", "--format=%P", "HEAD"])
	.trim().split(" "), [
	callbackDependentIntegrationLeftParent
	, callbackDependentIntegrationRightParent
	]
);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackDependentIntegrationHistoryPath]).trim(), ""
, "Never rewrite committed callback/dependent integration history");
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...callbackDependentIntegrationAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...callbackDependentIntegrationAddedPaths].sort());
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M", "HEAD", "--"])
	.trim().split("\n").filter(Boolean)
, ["tests/helpers/fin-refinement-source-history.mjs"]);

const fork = git(["merge-base"
	, callbackDependentIntegrationLeftParent
	, callbackDependentIntegrationRightParent]).trim();
const rightHistoryRecords = git(["diff", "--name-only", "--diff-filter=A"
	, fork, callbackDependentIntegrationRightParent, "--", "docs/evidence"])
	.trim().split("\n").filter(path =>
		/^docs\/evidence\/[^/]*history[^/]*\.json$/u.test(path)
	).sort();
assert.ok(rightHistoryRecords.length > 0);

const rightExpected = path => {
	const result = new Set([
		sha256(git(["show"
			, `${callbackDependentIntegrationRightParent}:${path}`]))
	]);
	const collect = value => {
		if(!value || typeof value !== "object") return;
		if(value.path === path)
			for(const key of ["currentSha256", "previousSha256"])
				if(typeof value[key] === "string"
					&& /^[a-f0-9]{64}$/u.test(value[key])) result.add(value[key]);
		for(const child of Object.values(value)) collect(child);
	};
	for(const historyPath of rightHistoryRecords)
	{
		let record;
		try
		{
			record = JSON.parse(git(["show"
				, `${callbackDependentIntegrationRightParent}:${historyPath}`]));
		}
		catch(error)
		{
			if(error instanceof SyntaxError) continue;
			throw error;
		}
		collect(record);
	}
	return [...result].sort();
};

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-dependent-integration-history-"
));
const edits = async (previous, current) => {
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
	const currentOffsets = [0];
	for(const line of currentLines)
		currentOffsets.push(currentOffsets.at(-1) + line.length);
	const result = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentOffsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(result.length > 0);
	return result;
};

try
{
	const updates = [];
	for(const path of callbackDependentIntegrationChangedPaths)
	{
		const current = await readFile(path, "utf8");
		const left = git(["show"
			, `${callbackDependentIntegrationLeftParent}:${path}`]);
		const right = git(["show"
			, `${callbackDependentIntegrationRightParent}:${path}`]);
		const update = {
			path, currentSha256: sha256(current)
			, left: {
				previousSha256: sha256(left), edits: await edits(left, current)
			}
			, right: {
				previousSha256: sha256(right), edits: await edits(right, current)
			}
			, rightExpectedSha256: rightExpected(path)
		};
		assert.equal(reverseCallbackDependentIntegrationUpdate(
			current, update, "left"), left, path);
		assert.equal(reverseCallbackDependentIntegrationUpdate(
			current, update, "right"), right, path);
		assert.ok(update.rightExpectedSha256.includes(sha256(right)));
		updates.push(update);
	}
	const additions = [];
	for(const path of callbackDependentIntegrationAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${callbackDependentIntegrationCommit}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackDependentIntegrationHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "callback-dependent-integration-source-v1"
			, integrationCommit: callbackDependentIntegrationCommit
			, parents: [
				callbackDependentIntegrationLeftParent
				, callbackDependentIntegrationRightParent
			]
			, forkCommit: fork, rightHistoryRecords
			, scope: "The callback checked-record and dependent checked-record archive histories retain both JavaScript refinement checks, both type-surface inventories and both reversible source-history chains. Right-parent-only milestone digests select that exact parent; shared ancestry follows the first parent."
			, additions, updates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} two-parent transitions, ${additions.length} additions and ${rightHistoryRecords.length} right-parent history records.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
