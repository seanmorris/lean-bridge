#!/usr/bin/env node
/**
 * Replay the complete committed owned checked-record hosted matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../src/capsule/node.mjs";
import { verifyOwnedCheckedRecordHostedMatrix } from "../tests/helpers/owned-checked-record-hosted-matrix.mjs";

const arguments_ = process.argv.slice(2);
assert.ok(arguments_.length === 2 && arguments_[0] === "--selection"
	, "Usage: check-owned-checked-record-matrix.mjs --selection /absolute/matrix-selection.json");
const selection = JSON.parse(await readFile(arguments_[1], "utf8"));
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const receipt = await verifyOwnedCheckedRecordHostedMatrix(selection, progress => {
	process.stderr.write(canonicalJson(progress));
});
process.stdout.write(canonicalJson(receipt));
