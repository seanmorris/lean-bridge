#!/usr/bin/env node
/**
 * Record the zero-payload .NET package-control diagnostic repair.
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
	reverseZeroPayloadDotnetControlRepairUpdate
	, zeroPayloadDotnetControlRepairChangedPaths
	, zeroPayloadDotnetControlRepairHistoryPath
	, zeroPayloadDotnetControlRepairImplementation
	, zeroPayloadDotnetControlRepairIntegrationPaths
	, zeroPayloadDotnetControlRepairPredecessor
} from "../tests/helpers/zero-payload-dotnet-control-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadDotnetControlRepairImplementation
	, "Zero-payload .NET control repair history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadDotnetControlRepairHistoryPath]).trim(), "");

const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-dotnet-control-repair-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-control-repair-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-control-repair-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "zero-payload-dotnet-control-repair-"));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
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
				previousStart, previousStart + previousCount
			).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount
			).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseZeroPayloadDotnetControlRepairUpdate(
		current, update
	), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadDotnetControlRepairChangedPaths)
		updates.push(await transition(
			path, zeroPayloadDotnetControlRepairPredecessor
		));
	const integrationUpdates = [];
	for(const path of zeroPayloadDotnetControlRepairIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadDotnetControlRepairImplementation
		));
	const additions = [];
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadDotnetControlRepairImplementation, "--", path]
		).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadDotnetControlRepairImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...zeroPayloadDotnetControlRepairIntegrationPaths].sort());
	const record = {
		schemaVersion: 1, milestone: "zero-payload-dotnet-control-repair-v1"
		, predecessorCommit: zeroPayloadDotnetControlRepairPredecessor
		, implementationCommit: zeroPayloadDotnetControlRepairImplementation
		, reconciledTypeSurfacePointers: 0
		, scope: "The destructive NuGet package control requires rejection without coupling evidence validity to incidental assertion prose."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadDotnetControlRepairHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
