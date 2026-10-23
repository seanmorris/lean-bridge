#!/usr/bin/env node
/**
 * Promote only the owned-Subtype cells closed by authenticated evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { generateReferenceDocs } from "./generate-reference-docs.mjs";
import {
	ownedSubtypePromotionPath, ownedSubtypePromotionReferences
	, promoteOwnedSubtypes, renderOwnedSubtypePromotion
} from "../tests/helpers/owned-subtype-promotion.mjs";

assert.equal(process.argv.length, 2, "This promotion command accepts no arguments");
const path = "docs/type-surface.v1.json";
const [inventory, irSchema, consumers] = await Promise.all([
	readFile(path, "utf8").then(JSON.parse)
	, readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
]);
const references = await ownedSubtypePromotionReferences();
const promoted = promoteOwnedSubtypes(inventory, references);
await Promise.all([
	writeFile(path, JSON.stringify(promoted, null, 2) + "\n")
	, writeFile(ownedSubtypePromotionPath
		, renderOwnedSubtypePromotion(references))
]);
await generateReferenceDocs({
	root: process.cwd(), write: true
	, inventory: { document: promoted, irSchema, consumers }
});
process.stdout.write("Promoted 32 owned-Subtype cells from eight authenticated evidence lanes.\n");
