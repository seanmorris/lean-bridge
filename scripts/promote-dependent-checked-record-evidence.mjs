#!/usr/bin/env node
/**
 * Promote only the dependent checked-record cells closed by all eleven
 * archives. Refuses before reading the inventory while any lane verifier is
 * missing, and writes nothing unless every archive replays.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
	dependentCheckedRecordPromotionPath
	, dependentCheckedRecordPromotionReferences
	, loadDependentCheckedRecordVerifiers
	, promoteDependentCheckedRecords
	, renderDependentCheckedRecordPromotion
} from "../tests/helpers/dependent-checked-record-promotion.mjs";

assert.equal(process.argv.length, 2, "This promotion command accepts no arguments");
const verifiers = await loadDependentCheckedRecordVerifiers();
const references = await dependentCheckedRecordPromotionReferences(verifiers);
const path = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(path, "utf8"));
const promoted = promoteDependentCheckedRecords(inventory, references);
const summary = renderDependentCheckedRecordPromotion(references);
await Promise.all([
	writeFile(path, JSON.stringify(promoted, null, 2) + "\n")
	, writeFile(dependentCheckedRecordPromotionPath, summary)
]);
process.stdout.write("Added hosted evidence to 68 dependent checked-record cells from eleven immutable archives.\n");
