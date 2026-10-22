#!/usr/bin/env node
/**
 * Promote only the callback Subtype cells closed by all eight archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { generateReferenceDocs } from "./generate-reference-docs.mjs";
import {
	callbackSubtypePromotionPath
	, callbackSubtypePromotionReferences
	, promoteCallbackSubtypes
	, renderCallbackSubtypePromotion
} from "../tests/helpers/callback-subtype-promotion.mjs";
import {
	renderCallbackSubtypeLeanAuthorDocs
} from "../tests/helpers/callback-subtype-documentation.mjs";

assert.equal(process.argv.length, 2, "This promotion command accepts no arguments");
const path = "docs/type-surface.v1.json";
const [inventory, irSchema, consumers, existingPackage, exportDecisions]
	= await Promise.all([
		readFile(path, "utf8").then(JSON.parse)
		, readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
		, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
		, readFile("docs/lean/existing-package.md", "utf8")
		, readFile("docs/lean/export-decisions.md", "utf8")
	]);
const references = await callbackSubtypePromotionReferences();
const promoted = promoteCallbackSubtypes(inventory, references);
const summary = renderCallbackSubtypePromotion(references);
const authorDocs = renderCallbackSubtypeLeanAuthorDocs({
	existingPackage, exportDecisions
});
await Promise.all([
	writeFile(path, JSON.stringify(promoted, null, 2) + "\n")
	, writeFile(callbackSubtypePromotionPath, summary)
	, writeFile("docs/lean/existing-package.md", authorDocs.existingPackage)
	, writeFile("docs/lean/export-decisions.md", authorDocs.exportDecisions)
]);
await generateReferenceDocs({
	root: process.cwd(), write: true
	, inventory: { document: promoted, irSchema, consumers }
});
process.stdout.write("Promoted 64 callback Subtype cells from eight immutable hosted archives.\n");
