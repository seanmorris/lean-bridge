#!/usr/bin/env node
/**
 * Record the hosted .NET zero-payload promotion.
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
	reverseZeroPayloadDotnetPromotionUpdate
	, zeroPayloadDotnetPromotionChangedPaths
	, zeroPayloadDotnetPromotionHistoryPath
	, zeroPayloadDotnetPromotionImplementation
	, zeroPayloadDotnetPromotionIntegrationPaths
	, zeroPayloadDotnetPromotionPredecessor
} from "../tests/helpers/zero-payload-dotnet-promotion-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadDotnetPromotionImplementation
	, "Zero-payload .NET promotion history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadDotnetPromotionHistoryPath]).trim(), "");

const applicationAdditions = Object.freeze([
	"docs/evidence/zero-payload-checked-record-dotnet-20261021.md"
	, "scripts/promote-zero-payload-checked-record-dotnet.mjs"
	, "tests/helpers/zero-payload-checked-record-dotnet-promotion.mjs"
	, "tests/zero-payload-checked-record-dotnet-promotion.test.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-dotnet-promotion-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-promotion-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-promotion-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "zero-payload-dotnet-promotion-history-"));
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
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseZeroPayloadDotnetPromotionUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadDotnetPromotionChangedPaths)
		updates.push(await transition(path, zeroPayloadDotnetPromotionPredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadDotnetPromotionIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadDotnetPromotionImplementation));
	const additions = [];
	for(const path of [...applicationAdditions, ...historyAdditions])
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadDotnetPromotionPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadDotnetPromotionImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadDotnetPromotionIntegrationPaths
		, "tests/zero-payload-checked-record-dotnet-promotion.test.mjs"
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "zero-payload-dotnet-promotion-source-v1"
		, predecessorCommit: zeroPayloadDotnetPromotionPredecessor
		, implementationCommit: zeroPayloadDotnetPromotionImplementation
		, reconciledTypeSurfacePointers: 243
		, scope: "Hosted .NET NuGet packages promote the retained zero-payload Witness, Token, Marker, Option, Array and Mark parameter/result boundary without widening fields, callbacks, ownership or another host."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadDotnetPromotionHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations, `
		+ `${additions.length} additions and 243 source-pin advances.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
