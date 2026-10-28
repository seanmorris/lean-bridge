#!/usr/bin/env node
/**
 * Record the Core historical-contract repair and its added history files from
 * exact Git blobs. Hub integration is recorded by a separate seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	coreHistoricalContractRepairAddedPaths
	, coreHistoricalContractRepairChangedPaths
	, coreHistoricalContractRepairCommits
	, coreHistoricalContractRepairHistoryPath
	, coreHistoricalContractRepairImplementation
	, coreHistoricalContractRepairPredecessor
	, reverseCoreHistoricalContractRepairUpdate
} from "../tests/helpers/core-historical-contract-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = coreHistoricalContractRepairPredecessor;
const implementation = coreHistoricalContractRepairImplementation;
const inventoryPath = "docs/type-surface.v1.json";

const inventoryTransition = (previous, current) => {
	assert.equal(previous.length, current.length);
	const edits = [];
	let start = 0;
	while(start < current.length)
	{
		const newline = current.indexOf("\n", start);
		const end = newline < 0 ? current.length : newline + 1;
		const before = previous.slice(start, end);
		const after = current.slice(start, end);
		if(before !== after)
		{
			assert.match(before, /^ *"sha256": "[0-9a-f]{64}"\n$/u);
			assert.match(after, /^ *"sha256": "[0-9a-f]{64}"\n$/u);
			edits.push({ start, previous: before, current: after });
		}
		start = end;
	}
	assert.equal(edits.length, 78);
	return {
		path: inventoryPath, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
};

assert.equal(spawnSync("git", ["cat-file", "-e", `${implementation}^{commit}`]
	, { stdio: "ignore" }).status, 0
, "This history requires its exact implementation commit");
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor", implementation
	, "HEAD"], { stdio: "ignore" }).status, 0
, "HEAD must descend from the exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`])
	.trim().split("\n"), coreHistoricalContractRepairCommits);
for(const [index, revision] of coreHistoricalContractRepairCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor : coreHistoricalContractRepairCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `HEAD:${coreHistoricalContractRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreHistoricalContractRepairChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...coreHistoricalContractRepairChangedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Only the untracked history layer may be present");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreHistoricalContractRepairAddedPaths])
, [...coreHistoricalContractRepairAddedPaths].sort());

const updates = [];
for(const path of coreHistoricalContractRepairChangedPaths)
{
	const previous = source(predecessor, path);
	const current = source(implementation, path);
	const update = path === inventoryPath
		? inventoryTransition(previous, current)
		: await gitSourceHistoryTransition(path, predecessor, implementation);
	assert.equal(reverseCoreHistoricalContractRepairUpdate(
		current, update), previous, path);
	updates.push(update);
}
const additions = [];
for(const path of coreHistoricalContractRepairAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(coreHistoricalContractRepairHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "core-historical-contract-repair-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, implementationCommits: coreHistoricalContractRepairCommits
	, scope: "Repair the residual Core historical contracts without changing their evidence claims. Scope the checked-record workflow's no-dependency assertion to its protected producer job while preserving failure propagation for the whole workflow. Regenerate the ten stale consumer type tables from the current inventory. Recount the immutable October 9 Wasm-entry archive against its retained expectation, TypeScript prelude and adapter columns rather than the later live Fin fixture, while preserving complete byte, transcript, source and refusal authentication. Refresh exactly 78 evidence pins for the changed guides and tests. Hub and registration integration are recorded by the integrating seal."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} updates and `
	+ `${additions.length} additions.\n`);
