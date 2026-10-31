#!/usr/bin/env node
/**
 * Reconcile live type-surface citations after the semantic Core repair.
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

const predecessor = "4456a0c2025a3e914ea9143ecdbe1192f339dfc7";
const implementation = "8f5e50a90602689f88c3213cbd182c620a30196b";
const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
}).trim();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: reconcile-core-semantic-gate-live-pins.mjs");
assert.equal(git(["rev-parse", "HEAD"]), implementation);
assert.equal(git(["rev-parse", "HEAD^"]), predecessor);
assert.equal(git(["status", "--porcelain"])
	, "?? scripts/reconcile-core-semantic-gate-live-pins.mjs"
	, "Reconcile only from the clean semantic milestone and this writer");
const changed = git(["diff", "--name-only", predecessor, implementation, "--"])
	.split("\n").filter(Boolean).sort();
assert.equal(changed.length, 168);

const before = JSON.parse(await readFile(inventoryPath, "utf8"));
const paths = dependentCheckedRecordPromotionCurrentSourcePaths(before, changed)
	.sort();
assert.equal(paths.length, 76);
const digests = new Map();
for(const path of paths) digests.set(path, sha256(await readFile(path)));
const reconciled = reconcileDependentCheckedRecordSourcePins(before, digests);
assert.equal(reconciled.refreshed, 552);
assert.deepEqual(reconciled.inventory.profiles, before.profiles);
assert.deepEqual(reconciled.inventory.shapes, before.shapes);
assert.deepEqual(reconciled.inventory.families, before.families);
assert.deepEqual(reconciled.inventory.observations, before.observations);
assert.deepEqual(reconciled.inventory.stages, before.stages);
assert.deepEqual(reconciled.inventory.evidence.map(item => item.id)
	, before.evidence.map(item => item.id));
await writeFile(inventoryPath
	, `${JSON.stringify(reconciled.inventory, null, 2)}\n`);
process.stdout.write(`Reconciled ${reconciled.refreshed} live citations across `
	+ `${paths.length} current source paths.\n`);
