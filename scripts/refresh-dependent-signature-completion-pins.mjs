#!/usr/bin/env node
/**
 * Refresh only current-source evidence pins changed by the dependent-signature
 * implementation and its pending history integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	dependentSignatureCompletionImplementation
	, dependentSignatureCompletionPredecessor
} from "../tests/helpers/dependent-signature-completion-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-dependent-signature-completion-pins.mjs");
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentSignatureCompletionImplementation
	, "Dependent-signature pins require the exact implementation head");
assert.doesNotThrow(() => execFileSync("git"
	, ["diff", "--cached", "--quiet", "HEAD", "--"]));

const inventoryPath = "docs/type-surface.v1.json";
assert.ok(!names(["diff", "--name-only", "HEAD", "--"])
	.includes(inventoryPath), "Type-surface pins have already been edited");
const changedPaths = [...new Set([
	...names(["diff", "--name-only", "--diff-filter=AM"
		, dependentSignatureCompletionPredecessor
		, dependentSignatureCompletionImplementation, "--"])
	, ...names(["diff", "--name-only", "--diff-filter=M", "HEAD", "--"])
])].filter(path => path !== inventoryPath
	&& !path.startsWith("docs/evidence/"));
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const currentSourcePaths
	= dependentCheckedRecordPromotionCurrentSourcePaths(
		inventory, changedPaths);
assert.ok(currentSourcePaths.length > 0
	, "Dependent-signature rollout changed no pinned current source");
const currentDigests = new Map();
for(const path of currentSourcePaths)
	currentDigests.set(path, sha256(await readFile(path)));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	inventory, currentDigests);
assert.ok(reconciled.refreshed > 0
	, "Dependent-signature rollout has no stale current-source pins");
await writeFile(inventoryPath
	, JSON.stringify(reconciled.inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${reconciled.refreshed} exact pins across `
	+ `${currentSourcePaths.length} current sources.\n`);
