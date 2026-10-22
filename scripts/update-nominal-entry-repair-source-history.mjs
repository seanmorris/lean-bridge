#!/usr/bin/env node
/**
 * Record the nominal entry-measurement identity and probe-order repair.
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
	nominalEntryRepairAddedPaths
	, nominalEntryRepairChangedPaths
	, nominalEntryRepairHistoryPath
	, nominalEntryRepairImplementation
	, nominalEntryRepairImplementationPaths
	, nominalEntryRepairPredecessor
	, reverseNominalEntryRepairUpdate
} from "../tests/helpers/nominal-entry-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, nominalEntryRepairImplementation
	, "Nominal entry repair history is draft-only at its implementation commit");
assert.equal(git(["merge-base", nominalEntryRepairPredecessor
	, nominalEntryRepairImplementation]).trim()
, nominalEntryRepairPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, nominalEntryRepairPredecessor
	, nominalEntryRepairImplementation]).trim().split("\n").sort()
, [...nominalEntryRepairImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, nominalEntryRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-nominal-entry-repair-history-"));
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
	assert.equal(reverseNominalEntryRepairUpdate(
		current, update), previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${nominalEntryRepairPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of nominalEntryRepairChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, nominalEntryRepairPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of nominalEntryRepairChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of nominalEntryRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, nominalEntryRepairPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(nominalEntryRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "nominal-entry-repair-v1"
		, predecessorCommit: nominalEntryRepairPredecessor
		, implementationCommit: nominalEntryRepairImplementation
		, scope: "The native nominal dispatch classifier hashes adapter symbols with the component identity the compiler derives from the fixture's Lake package, nominalsubtypes@1.0.0, and the wasm entry probe keeps a pattern-matching definition's equations under its renamed body before the marked wrapper, so Lean resolves the body. No installed measurement is claimed."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
