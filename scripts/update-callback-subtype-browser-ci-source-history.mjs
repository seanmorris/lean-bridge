#!/usr/bin/env node
/**
 * Record the exact source closure for hosted callback Subtype browser CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	callbackSubtypeBrowserCiAddedPaths
	, callbackSubtypeBrowserCiHistoryPath
	, callbackSubtypeBrowserCiImplementation
	, callbackSubtypeBrowserCiPredecessor
} from "../tests/helpers/callback-subtype-browser-ci-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeBrowserCiImplementation
	, "Callback Subtype browser CI history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeBrowserCiHistoryPath]).trim(), ""
, "Never rewrite committed callback Subtype browser CI history");

const additions = [];
for(const path of callbackSubtypeBrowserCiAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only"
		, callbackSubtypeBrowserCiPredecessor, "--", path]).trim(), "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, callbackSubtypeBrowserCiImplementation, "--"])
	.trim().split("\n").filter(Boolean)
, ["tests/callback-subtype-browser-ci.test.mjs"]);
await writeFile(callbackSubtypeBrowserCiHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "callback-subtype-browser-ci-source-v1"
	, predecessorCommit: callbackSubtypeBrowserCiPredecessor
	, implementationCommit: callbackSubtypeBrowserCiImplementation
	, additions
}), { flag: "wx" });
process.stdout.write(`Recorded ${additions.length} callback Subtype browser CI additions.\n`);
