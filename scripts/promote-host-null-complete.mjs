#!/usr/bin/env node
/**
 * Promote exactly the complete 170-cell hosted HostNull matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
	hostNullCompletePromotionReference, promoteHostNullComplete
} from "../tests/helpers/host-null-complete-promotion.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: promote-host-null-complete.mjs");
const path = "docs/type-surface.v1.json";
const [inventory, irSchema, consumers] = await Promise.all([
	path, "schema/binding-ir.schema.json", "docs/consumer-support.v1.json"
].map(async file => JSON.parse(await readFile(file, "utf8"))));
const reference = await hostNullCompletePromotionReference();
const proposed = promoteHostNullComplete(
	inventory, { irSchema, consumers }, reference);
await writeFile(path, JSON.stringify(proposed, null, 2) + "\n");
process.stdout.write(
	"Promoted one complete hosted HostNull archive through 22 observations and exactly 170 cells.\n"
);
