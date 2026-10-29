#!/usr/bin/env node
/**
 * Refresh only live GMP-facade citations changed by the optional-parameter
 * installed-acceptance repair.
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

const predecessor = "147e49e0f3a69769fedcdf0e6f2f022d1cd5c44d";
const implementation = "891de40598ff94769283ff00bc84ffc01c1d3a34";
const inventoryPath = "docs/type-surface.v1.json";
const expectedPaths = ["src/backends/c/gmp-projection.mjs"];
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-optional-parameter-installed-acceptance-repair-pins.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Installed-acceptance pins require the exact C repair head");
assert.doesNotThrow(() => execFileSync("git"
	, ["diff", "--cached", "--quiet", "HEAD", "--"]));
assert.ok(!names(["diff", "--name-only", "HEAD", "--"])
	.includes(inventoryPath), "Type-surface pins have already been edited");

const changedPaths = names([
	"diff", "--name-only", "--diff-filter=AM", predecessor, implementation, "--"
]);
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.deepEqual(currentSourcePaths, expectedPaths);
const currentDigests = new Map();
for(const path of currentSourcePaths)
	currentDigests.set(path, sha256(git(["show", `${implementation}:${path}`])));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	inventory, currentDigests);
assert.ok(reconciled.refreshed > 0
	, "GMP facade has no stale current-source pins");
await writeFile(inventoryPath
	, JSON.stringify(reconciled.inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${reconciled.refreshed} exact pins across `
	+ `${currentSourcePaths.length} current source.\n`);
