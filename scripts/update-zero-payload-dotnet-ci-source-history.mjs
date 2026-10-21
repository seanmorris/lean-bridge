#!/usr/bin/env node
/**
 * Record the zero-payload .NET hosted-verification milestone.
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
	reverseZeroPayloadDotnetCiUpdate, zeroPayloadDotnetCiChangedPaths
	, zeroPayloadDotnetCiHistoryPath, zeroPayloadDotnetCiImplementation
	, zeroPayloadDotnetCiIntegrationPaths, zeroPayloadDotnetCiPredecessor
} from "../tests/helpers/zero-payload-dotnet-ci-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadDotnetCiImplementation
	, "Zero-payload .NET CI history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadDotnetCiHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload .NET CI history");

const applicationAdditions = Object.freeze([
	".github/workflows/zero-payload-checked-record-dotnet.yml"
	, "scripts/check-zero-payload-checked-record-dotnet-ci.mjs"
	, "scripts/run-zero-payload-checked-record-dotnet-ci.sh"
	, "tests/helpers/zero-payload-checked-record-dotnet-ci-report-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-dotnet-ci-report.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-dotnet-ci-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-ci-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-ci-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-dotnet-ci-history-"
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
	assert.equal(reverseZeroPayloadDotnetCiUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadDotnetCiChangedPaths)
		updates.push(await transition(path, zeroPayloadDotnetCiPredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadDotnetCiIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadDotnetCiImplementation
		));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadDotnetCiPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadDotnetCiImplementation, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadDotnetCiImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadDotnetCiChangedPaths
		, ...zeroPayloadDotnetCiIntegrationPaths
	].sort());
	const record = {
		schemaVersion: 1, milestone: "zero-payload-dotnet-ci-source-v1"
		, predecessorCommit: zeroPayloadDotnetCiPredecessor
		, implementationCommit: zeroPayloadDotnetCiImplementation
		, reconciledTypeSurfacePointers: 0
		, scope: "Hosted zero-payload NuGet acceptance retains all four author/API routes and independently reconciles their package, execution and source identities."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadDotnetCiHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${integrationUpdates.length} integrations, ${additions.length} additions and 0 type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
