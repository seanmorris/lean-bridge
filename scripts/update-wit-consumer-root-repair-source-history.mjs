#!/usr/bin/env node
/**
 * Record the WIT dependent checked-record consumer-root repair.
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
	witConsumerRootRepairAddedPaths
	, witConsumerRootRepairChangedPaths
	, witConsumerRootRepairHistoryPath
	, witConsumerRootRepairImplementation
	, witConsumerRootRepairImplementationPaths
	, witConsumerRootRepairPredecessor
	, reverseWitConsumerRootRepairUpdate
} from "../tests/helpers/wit-consumer-root-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, witConsumerRootRepairImplementation
	, "WIT consumer-root repair history is draft-only at its implementation commit");
assert.equal(git(["merge-base", witConsumerRootRepairPredecessor
	, witConsumerRootRepairImplementation]).trim()
, witConsumerRootRepairPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, witConsumerRootRepairPredecessor
	, witConsumerRootRepairImplementation]).trim().split("\n").sort()
, [...witConsumerRootRepairImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, witConsumerRootRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-wit-consumer-root-repair-history-"));
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
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseWitConsumerRootRepairUpdate(
		current, update), previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${witConsumerRootRepairPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of witConsumerRootRepairChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, witConsumerRootRepairPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of witConsumerRootRepairChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of witConsumerRootRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, witConsumerRootRepairPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(witConsumerRootRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "wit-consumer-root-repair-v1"
		, predecessorCommit: witConsumerRootRepairPredecessor
		, implementationCommit: witConsumerRootRepairImplementation
		, scope: "The WIT dependent checked-record lane names its immutable C caller root once, tests/fixtures/dependent-checked-record-consumers/, in the fixture reader, the installed git guard and the producer-revision reconstruction, replacing a cloned tests/fixtures/dependent-checked-record-wit/ root that never existed. A source-only control proves both files are committed and that reconstruction follows the producer revision. No installed run is claimed."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
