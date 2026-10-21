#!/usr/bin/env node
/**
 * Record the zero-payload .NET package foundation.
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
	reverseZeroPayloadDotnetUpdate, zeroPayloadDotnetChangedPaths
	, zeroPayloadDotnetHistoryPath, zeroPayloadDotnetImplementation
	, zeroPayloadDotnetIntegrationPaths, zeroPayloadDotnetPredecessor
} from "../tests/helpers/zero-payload-dotnet-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), zeroPayloadDotnetImplementation
	, "Zero-payload .NET history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadDotnetHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload .NET history");

const applicationAdditions = Object.freeze([
	"tests/fixtures/zero-payload-checked-record-dotnet/dotnet.cs"
	, "tests/helpers/zero-payload-checked-record-dotnet-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-dotnet-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-dotnet-installed-tests.mjs"
	, "tests/zero-payload-checked-record-dotnet.test.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-dotnet-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-dotnet-history-"
));
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
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.equal(reverseZeroPayloadDotnetUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadDotnetChangedPaths)
		updates.push(await transition(path, zeroPayloadDotnetImplementation));
	const integrationUpdates = [];
	for(const path of zeroPayloadDotnetIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadDotnetImplementation
		));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadDotnetPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadDotnetImplementation, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadDotnetImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadDotnetChangedPaths
		, ...zeroPayloadDotnetIntegrationPaths
	].sort());
	const record = {
		schemaVersion: 1, milestone: "zero-payload-dotnet-source-v1"
		, predecessorCommit: zeroPayloadDotnetPredecessor
		, implementationCommit: zeroPayloadDotnetImplementation
		, reconciledTypeSurfacePointers: 0
		, scope: "Generated C# keeps proof-only, Unit-bearing and plain empty records nominally distinct across full and result-only NuGet package routes."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadDotnetHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${integrationUpdates.length} integrations, ${additions.length} additions and 0 type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
