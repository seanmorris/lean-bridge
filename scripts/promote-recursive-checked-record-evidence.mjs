#!/usr/bin/env node
/**
 * Promote the complete recursive checked-record archive set into the public
 * support inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
	promoteRecursiveCheckedRecords, recursiveCheckedRecordReferences
} from "../tests/helpers/recursive-checked-record-promotion.mjs";

assert.deepEqual(process.argv.slice(2), []);
const path = "docs/type-surface.v1.json";
const original = JSON.parse(await readFile(path, "utf8"));
const references = await recursiveCheckedRecordReferences();
assert.equal(references.length, 36);
const promoted = await promoteRecursiveCheckedRecords(original, references);
assert.equal(promoted.evidence.length, original.evidence.length + 36);
assert.equal(promoted.observations.length, original.observations.length);
await writeFile(path, JSON.stringify(promoted, null, 2) + "\n");
process.stdout.write("Promoted 36 recursive checked-record evidence entries across exactly 102 existing cells.\n");
