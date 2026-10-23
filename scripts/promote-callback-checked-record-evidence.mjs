#!/usr/bin/env node
/**
 * Promote only the callback checked-record cells closed by all eight archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
	callbackCheckedRecordPromotionPath
	, callbackCheckedRecordPromotionEvidenceIds
	, callbackCheckedRecordPromotionReferences
	, promoteCallbackCheckedRecords
	, refreshCallbackCheckedRecords
	, renderCallbackCheckedRecordPromotion
} from "../tests/helpers/callback-checked-record-promotion.mjs";

assert.equal(process.argv.length, 2, "This promotion command accepts no arguments");
const path = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(path, "utf8"));
const references = await callbackCheckedRecordPromotionReferences();
const present = callbackCheckedRecordPromotionEvidenceIds.filter(id =>
	inventory.evidence.some(item => item.id === id));
assert.ok(present.length === 0
	|| present.length === callbackCheckedRecordPromotionEvidenceIds.length
, "Callback checked-record promotion is only partially present");
const promoted = present.length === 0
	? promoteCallbackCheckedRecords(inventory, references)
	: refreshCallbackCheckedRecords(inventory, references);
const summary = renderCallbackCheckedRecordPromotion(references);
await Promise.all([
	writeFile(path, JSON.stringify(promoted, null, 2) + "\n")
	, writeFile(callbackCheckedRecordPromotionPath, summary)
]);
process.stdout.write(`${present.length === 0 ? "Promoted" : "Refreshed"} 64 callback checked-record cells from eight immutable hosted archives.\n`);
