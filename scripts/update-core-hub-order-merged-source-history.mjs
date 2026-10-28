#!/usr/bin/env node
/**
 * Record the exact local Core hub-order repair transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	coreHubOrderMergedAddedPaths, coreHubOrderMergedHistoryPath
	, coreHubOrderMergedImplementation, coreHubOrderMergedPaths
	, coreHubOrderMergedPredecessor, reverseCoreHubOrderMergedUpdate
} from "../tests/helpers/core-hub-order-merged-source-history.mjs";
import { coreHubOrderRepairHistoryPath } from "../tests/helpers/core-hub-order-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = coreHubOrderMergedPredecessor;
const implementation = coreHubOrderMergedImplementation;
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
	assert.equal(edits.length, 4);
	return { path: inventoryPath, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
};

assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor", implementation
	, "HEAD"], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreHubOrderMergedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `HEAD:${coreHubOrderMergedHistoryPath}`], { stdio: "ignore" }).status, 0
, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreHubOrderMergedAddedPaths]), [...coreHubOrderMergedAddedPaths].sort());

const updates = [];
for(const path of coreHubOrderMergedPaths)
{
	const previous = source(predecessor, path);
	const current = source(implementation, path);
	const update = path === inventoryPath
		? inventoryTransition(previous, current)
		: await gitSourceHistoryTransition(path, predecessor, implementation);
	assert.equal(reverseCoreHubOrderMergedUpdate(current, update), previous);
	updates.push(update);
}
const additions = [];
for(const path of coreHubOrderMergedAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(coreHubOrderMergedHistoryPath, canonicalJson({
	schemaVersion: 1, milestone: "core-hub-order-merged-source-v1"
	, predecessorCommit: predecessor, implementationCommit: implementation
	, upstreamHistory: { path: coreHubOrderRepairHistoryPath
		, sha256: sha256(await readFile(coreHubOrderRepairHistoryPath)) }
	, scope: "Authenticate the exact hub-order repair cherry-pick on the local Core line. Reverse the three source changes and exactly four corresponding live type-surface pin edits without rewriting Claude's independently retained upstream history."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} merged Core transitions.\n`);
