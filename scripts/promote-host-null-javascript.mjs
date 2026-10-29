#!/usr/bin/env node
/**
 * Promote exactly the 50 hosted JavaScript/browser HostNull cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
	hostNullJavaScriptPromotionReference, promoteHostNullJavaScript
} from "../tests/helpers/host-null-javascript-promotion.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: promote-host-null-javascript.mjs");
const path = "docs/type-surface.v1.json";
const [inventory, irSchema, consumers] = await Promise.all([
	path, "schema/binding-ir.schema.json", "docs/consumer-support.v1.json"
].map(async file => JSON.parse(await readFile(file, "utf8"))));
const reference = await hostNullJavaScriptPromotionReference();
const proposed = promoteHostNullJavaScript(
	inventory, { irSchema, consumers }, reference);
await writeFile(path, JSON.stringify(proposed, null, 2) + "\n");
process.stdout.write(
	"Promoted the hosted HostNull archive through two observations and exactly 50 JavaScript/browser cells.\n");
