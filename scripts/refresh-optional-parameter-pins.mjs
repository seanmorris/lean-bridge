#!/usr/bin/env node
/**
 * Refresh only existing current-source pins changed by the optional-parameter
 * implementation. Immutable evidence and support observations stay untouched.
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

const predecessor = "ddc31428d44e92eeabcf8d301bf765c826b8bc0b";
const implementation = "8983447e75753eed71bb07980cebecc00b966ff8";
const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-optional-parameter-pins.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Optional-parameter pins require the exact feature head");
assert.doesNotThrow(() => execFileSync("git"
	, ["diff", "--cached", "--quiet", "HEAD", "--"]));
assert.ok(!names(["diff", "--name-only", "HEAD", "--"])
	.includes(inventoryPath), "Type-surface pins have already been edited");

const changedPaths = names([
	"diff", "--name-only", "--diff-filter=AM", predecessor, implementation, "--"
]);
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const currentSourcePaths
	= dependentCheckedRecordPromotionCurrentSourcePaths(
		inventory, changedPaths);
assert.ok(currentSourcePaths.length > 0
	, "Optional-parameter rollout changed no pinned current source");
const currentDigests = new Map();
for(const path of currentSourcePaths)
	currentDigests.set(path, sha256(git(["show", `${implementation}:${path}`])));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	inventory, currentDigests);
assert.ok(reconciled.refreshed > 0
	, "Optional-parameter rollout has no stale current-source pins");
await writeFile(inventoryPath
	, JSON.stringify(reconciled.inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${reconciled.refreshed} exact pins across `
	+ `${currentSourcePaths.length} current sources.\n`);
