#!/usr/bin/env node
/**
 * Promote only the generic-Subtype cells closed by hosted evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { generateReferenceDocs } from "./generate-reference-docs.mjs";
import {
	genericSubtypePromotionPath, genericSubtypePromotionReferences
	, promoteGenericSubtypes, renderGenericSubtypePromotion
} from "../tests/helpers/generic-subtype-promotion.mjs";
import {
	genericSubtypeDocumentationPaths, renderGenericSubtypeDocumentation
} from "../tests/helpers/generic-subtype-documentation.mjs";

assert.equal(process.argv.length, 2
	, "This promotion command accepts no arguments");
const path = "docs/type-surface.v1.json";
const [inventory, irSchema, consumers] = await Promise.all([
	readFile(path, "utf8").then(JSON.parse)
	, readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
]);
const references = await genericSubtypePromotionReferences();
const promoted = promoteGenericSubtypes(inventory, references);
await Promise.all([
	writeFile(path, JSON.stringify(promoted, null, 2) + "\n")
	, writeFile(genericSubtypePromotionPath
		, renderGenericSubtypePromotion(references))
]);
await generateReferenceDocs({
	root: process.cwd(), write: true
	, inventory: { document: promoted, irSchema, consumers }
});
const documentationSources = Object.fromEntries(await Promise.all(
	Object.entries(genericSubtypeDocumentationPaths).map(
		async ([name, documentPath]) => [
			name, await readFile(documentPath, "utf8")
		]
	)
));
const documentation = renderGenericSubtypeDocumentation(documentationSources);
await Promise.all(Object.entries(genericSubtypeDocumentationPaths)
	.map(([name, documentPath]) => writeFile(documentPath
		, documentation[name])));
process.stdout.write(
	"Promoted 32 closed generic-Subtype field cells from twelve hosted archives.\n"
);
