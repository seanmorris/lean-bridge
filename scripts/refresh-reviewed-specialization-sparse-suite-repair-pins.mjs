#!/usr/bin/env node
/**
 * Refresh only the live citations changed by separating retained reviewed-
 * specialization evidence from sparse consumer runtime acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const currentSourcePaths = Object.freeze([
	"tests/helpers/reviewed-api-promotion-tests.mjs"
	, "tests/reviewed-specializations.test.mjs"
]);
assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-reviewed-specialization-sparse-suite-repair-pins.mjs");
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, currentSourcePaths).sort(), [...currentSourcePaths].sort());
const digests = new Map();
for(const path of currentSourcePaths)
	digests.set(path, sha256(await readFile(path)));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	inventory, digests);
assert.equal(reconciled.refreshed, 6);
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
