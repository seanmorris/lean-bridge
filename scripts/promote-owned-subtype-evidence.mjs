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
import {
	ownedSubtypeDocumentationPaths, renderOwnedSubtypeDocumentation
} from "../tests/helpers/owned-subtype-documentation.mjs";

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
const documentationSources = Object.fromEntries(await Promise.all(
	Object.entries(ownedSubtypeDocumentationPaths).map(
		async ([name, documentPath]) => [
			name, await readFile(documentPath, "utf8")
		]
	)
));
const documentation = renderOwnedSubtypeDocumentation(documentationSources);
await Promise.all(Object.entries(ownedSubtypeDocumentationPaths)
	.map(([name, documentPath]) => writeFile(documentPath
		, documentation[name])));
process.stdout.write("Promoted 32 owned-Subtype cells from eight authenticated evidence lanes.\n");
