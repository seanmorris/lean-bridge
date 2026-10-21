#!/usr/bin/env node
/**
 * Record the exact type-surface transitions omitted by the zero-payload
 * Python and Ruby history layers.
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
	reverseZeroPayloadTypeSurfaceGapHistorical
	, reverseZeroPayloadTypeSurfaceGapIntegration
	, zeroPayloadTypeSurfaceGapAddedPaths
	, zeroPayloadTypeSurfaceGapHistoricalPaths
	, zeroPayloadTypeSurfaceGapHistoryPath
	, zeroPayloadTypeSurfaceGapIntegrationPaths
	, zeroPayloadTypeSurfaceGapPredecessor
} from "../tests/helpers/zero-payload-type-surface-gap-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadTypeSurfaceGapPredecessor
	, "Type-surface gap history requires its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadTypeSurfaceGapHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "zero-payload-type-surface-gap-history-"));
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
	return {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
};

try
{
	const historicalTransitions = [];
	for(const [previousCommit, currentCommit] of [
		["0d420c0dda5953f0167f55421887838a646b6296"
			, "a8d917cbefe102a098f8469f7fa4522b6ea6adf5"]
		, ["a6173cade3bbe158baa1a5695e3e93e1037359b0"
			, "0d420c0dda5953f0167f55421887838a646b6296"]
	]) for(const path of zeroPayloadTypeSurfaceGapHistoricalPaths)
	{
		const update = {
			...await transition(path
				, git(["show", `${previousCommit}:${path}`])
				, git(["show", `${currentCommit}:${path}`]))
			, previousCommit, currentCommit
		};
		assert.equal(reverseZeroPayloadTypeSurfaceGapHistorical(
			git(["show", `${currentCommit}:${path}`]), update)
		, git(["show", `${previousCommit}:${path}`]));
		historicalTransitions.push(update);
	}
	const integrationUpdates = [];
	for(const path of zeroPayloadTypeSurfaceGapIntegrationPaths)
	{
		const update = await transition(path
			, git(["show", `${zeroPayloadTypeSurfaceGapPredecessor}:${path}`])
			, await readFile(path, "utf8"));
		assert.equal(reverseZeroPayloadTypeSurfaceGapIntegration(
			await readFile(path, "utf8"), update)
		, git(["show", `${zeroPayloadTypeSurfaceGapPredecessor}:${path}`]));
		integrationUpdates.push(update);
	}
	const additions = [];
	for(const path of zeroPayloadTypeSurfaceGapAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadTypeSurfaceGapPredecessor, "--", path]).trim(), "");
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadTypeSurfaceGapPredecessor, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [...zeroPayloadTypeSurfaceGapIntegrationPaths].sort());
	const record = {
		schemaVersion: 1
		, milestone: "zero-payload-type-surface-gap-source-v1"
		, predecessorCommit: zeroPayloadTypeSurfaceGapPredecessor
		, scope: "Restore the two exact type-surface pointer-inventory transitions omitted by the zero-payload Python and Ruby history layers without changing support claims."
		, historicalPaths: zeroPayloadTypeSurfaceGapHistoricalPaths
		, historicalTransitions, integrationUpdates, additions
	};
	await writeFile(zeroPayloadTypeSurfaceGapHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${historicalTransitions.length} omitted `
		+ `transitions, ${integrationUpdates.length} integrations and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
