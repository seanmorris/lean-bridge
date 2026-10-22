#!/usr/bin/env node
/**
 * Promote only the callback checked-record cells closed by all eight archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
	callbackCheckedRecordPromotionReferences
	, promoteCallbackCheckedRecords
} from "../tests/helpers/callback-checked-record-promotion.mjs";

assert.equal(process.argv.length, 2, "This promotion command accepts no arguments");
const path = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(path, "utf8"));
const references = await callbackCheckedRecordPromotionReferences();
const promoted = promoteCallbackCheckedRecords(inventory, references);
await writeFile(path, JSON.stringify(promoted, null, 2) + "\n");
process.stdout.write("Promoted 64 callback checked-record cells from eight immutable hosted archives.\n");
