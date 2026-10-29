#!/usr/bin/env node
/**
 * Refresh the 33 stale promotion-reader pins left by optional publication.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import {
	optionalParameterPromotionIoPath
	, repairOptionalParameterPromotionIoPins
} from "../tests/helpers/optional-parameter-promotion-io-pin-repair.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: refresh-optional-parameter-promotion-io-pins.mjs");
const inventoryPath = "docs/type-surface.v1.json";
const [inventoryBytes, sourceBytes] = await Promise.all([
	readFile(inventoryPath), readFile(optionalParameterPromotionIoPath)
]);
const inventory = JSON.parse(inventoryBytes);
const repaired = repairOptionalParameterPromotionIoPins(
	inventory, sha256(sourceBytes));
await writeFile(inventoryPath, JSON.stringify(repaired, null, 2) + "\n");
process.stdout.write("Refreshed 33 promotion-reader source pins without changing support.\n");
