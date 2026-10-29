#!/usr/bin/env node
/**
 * Promote exactly the 20 hosted native PHP and PHP-Wasm HostNull cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
	hostNullPhpPromotionReferences, promoteHostNullPhp
} from "../tests/helpers/host-null-php-promotion.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: promote-host-null-php.mjs");
const path = "docs/type-surface.v1.json";
const [inventory, irSchema, consumers] = await Promise.all([
	path, "schema/binding-ir.schema.json", "docs/consumer-support.v1.json"
].map(async file => JSON.parse(await readFile(file, "utf8"))));
const references = await hostNullPhpPromotionReferences();
const proposed = promoteHostNullPhp(
	inventory, { irSchema, consumers }, references);
await writeFile(path, JSON.stringify(proposed, null, 2) + "\n");
process.stdout.write(
	"Promoted two hosted PHP HostNull archives through four observations and exactly 20 cells.\n");
