#!/usr/bin/env node
/**
 * Record the omitted 18804049 Perl callback contract transition and
 * this layer's added files from exact Git blobs. Hub integration is recorded
 * separately by the integrating seal.
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
	reversePerlCallbackContractGapUpdate
	, perlCallbackContractGapAddedPaths
	, perlCallbackContractGapHistoricalCommit
	, perlCallbackContractGapHistoricalPaths
	, perlCallbackContractGapHistoricalPredecessor
	, perlCallbackContractGapHistoryPath
	, perlCallbackContractGapPredecessor
} from "../tests/helpers/perl-callback-contract-gap-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 16 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = perlCallbackContractGapPredecessor;
const historicalCommit = perlCallbackContractGapHistoricalCommit;
const historicalPredecessor = perlCallbackContractGapHistoricalPredecessor;

assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor
	, "This history requires its exact predecessor commit");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${predecessor}:${perlCallbackContractGapHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.equal(git(["rev-parse", `${historicalCommit}^`]).trim()
	, historicalPredecessor, "The omitted transition has one parent");
const historicalChanges = names(["diff", "--name-only"
	, historicalPredecessor, historicalCommit]);
for(const path of perlCallbackContractGapHistoricalPaths)
{
	assert.ok(historicalChanges.includes(path), path);
	assert.equal(git(["rev-parse", `${predecessor}:${path}`]).trim()
		, git(["rev-parse", `${historicalCommit}:${path}`]).trim()
		, `${path} still carries its ${historicalCommit} bytes`);
}
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...perlCallbackContractGapAddedPaths])
, [...perlCallbackContractGapAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-perl-callback-contract-gap-"));
const transition = async (path, previous, current, commits) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
			, previousPath, currentPath]
		, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = [0];
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: offsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	const update = {
		path
		, ...commits
		, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reversePerlCallbackContractGapUpdate(current, update), previous, path);
	return update;
};

try
{
	const historicalTransitions = [];
	for(const path of perlCallbackContractGapHistoricalPaths)
		historicalTransitions.push(await transition(path
			, source(historicalPredecessor, path), source(historicalCommit, path)
			, {
				previousCommit: historicalPredecessor, currentCommit: historicalCommit
			}
		));
	const additions = [];
	for(const path of perlCallbackContractGapAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${predecessor}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(perlCallbackContractGapHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "perl-callback-contract-gap-source-v1"
		, predecessorCommit: predecessor
		, historicalPredecessorCommit: historicalPredecessor
		, historicalCommit
		, scope: "Restore the Perl callback contract transition from 18804049 that no history record carried, so hub-routed readers restore the exact helper bytes pinned by the completed and optional-install Perl callback receipts; no evidence, observation or support claim changes. Hub and registration integration are recorded by the integrating seal."
		, additions, historicalTransitions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${historicalTransitions.length} omitted `
		+ `historical transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
