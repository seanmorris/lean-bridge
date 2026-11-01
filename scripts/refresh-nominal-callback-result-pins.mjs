#!/usr/bin/env node
/**
 * Refresh only the live type-surface citations changed by the nominal callback
 * result enforcement repair.
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

const implementation = "596229fd294f34417dc7fc2c80a34743703192d7";
const inventoryPath = "docs/type-surface.v1.json";
const currentSourcePaths = Object.freeze([
	"src/build/component-structured-callable-adapters.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
]);
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
}).trim();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-nominal-callback-result-pins.mjs");
assert.equal(git(["rev-parse", "HEAD"]), implementation);
assert.equal(git(["status", "--porcelain"])
	, "?? scripts/refresh-nominal-callback-result-pins.mjs");
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, currentSourcePaths).sort(), [...currentSourcePaths].sort());
const digests = new Map();
for(const path of currentSourcePaths)
	digests.set(path, sha256(await readFile(path)));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	inventory, digests);
assert.equal(reconciled.refreshed, 7);
assert.deepEqual(reconciled.inventory.profiles, inventory.profiles);
assert.deepEqual(reconciled.inventory.shapes, inventory.shapes);
assert.deepEqual(reconciled.inventory.families, inventory.families);
assert.deepEqual(reconciled.inventory.observations, inventory.observations);
assert.deepEqual(reconciled.inventory.stages, inventory.stages);
assert.deepEqual(reconciled.inventory.evidence.map(item => item.id)
	, inventory.evidence.map(item => item.id));
await writeFile(inventoryPath
	, `${JSON.stringify(reconciled.inventory, null, 2)}\n`);
process.stdout.write(`Refreshed ${reconciled.refreshed} live citations across `
	+ `${currentSourcePaths.length} current source paths.\n`);
