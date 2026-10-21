#!/usr/bin/env node
/**
 * Record the stable-author-input verifier repair.
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
	reverseZeroPayloadDotnetVerifierRepairUpdate
	, zeroPayloadDotnetVerifierRepairChangedPaths
	, zeroPayloadDotnetVerifierRepairHistoryPath
	, zeroPayloadDotnetVerifierRepairImplementation
	, zeroPayloadDotnetVerifierRepairIntegrationPaths
	, zeroPayloadDotnetVerifierRepairPredecessor
} from "../tests/helpers/zero-payload-dotnet-verifier-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadDotnetVerifierRepairImplementation
	, "Zero-payload .NET verifier repair history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadDotnetVerifierRepairHistoryPath]).trim(), "");

const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-dotnet-verifier-repair-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-verifier-repair-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-verifier-repair-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(tmpdir(), "zero-payload-dotnet-repair-"));
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
	assert.ok(edits.length > 0);
	assert.equal(reverseZeroPayloadDotnetVerifierRepairUpdate(current, update)
		, previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadDotnetVerifierRepairChangedPaths)
		updates.push(await transition(
			path, zeroPayloadDotnetVerifierRepairPredecessor
		));
	const integrationUpdates = [];
	for(const path of zeroPayloadDotnetVerifierRepairIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadDotnetVerifierRepairImplementation
		));
	const additions = [];
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadDotnetVerifierRepairImplementation, "--", path]
		).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadDotnetVerifierRepairImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadDotnetVerifierRepairChangedPaths.filter(path =>
			path !== "tests/helpers/zero-payload-checked-record-dotnet-ci-report.mjs")
		, ...zeroPayloadDotnetVerifierRepairIntegrationPaths
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "zero-payload-dotnet-verifier-repair-v1"
		, predecessorCommit: zeroPayloadDotnetVerifierRepairPredecessor
		, implementationCommit: zeroPayloadDotnetVerifierRepairImplementation
		, reconciledTypeSurfacePointers: 0
		, scope: "The independent NuGet verifier hashes only stable author-input fields while retaining timestamps solely as original observations."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadDotnetVerifierRepairHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${integrationUpdates.length} integrations and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
