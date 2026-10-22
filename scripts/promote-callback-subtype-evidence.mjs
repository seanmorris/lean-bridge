#!/usr/bin/env node
/**
 * Promote only the callback Subtype cells closed by all eight archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
	callbackSubtypePromotionPath
	, callbackSubtypePromotionReferences
	, promoteCallbackSubtypes
	, renderCallbackSubtypePromotion
} from "../tests/helpers/callback-subtype-promotion.mjs";

assert.equal(process.argv.length, 2, "This promotion command accepts no arguments");
const path = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(path, "utf8"));
const references = await callbackSubtypePromotionReferences();
const promoted = promoteCallbackSubtypes(inventory, references);
const summary = renderCallbackSubtypePromotion(references);
await Promise.all([
	writeFile(path, JSON.stringify(promoted, null, 2) + "\n")
	, writeFile(callbackSubtypePromotionPath, summary)
]);
process.stdout.write("Promoted 64 callback Subtype cells from eight immutable hosted archives.\n");
