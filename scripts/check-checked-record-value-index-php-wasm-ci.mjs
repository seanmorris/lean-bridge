#!/usr/bin/env node
/**
 * Recheck one retained value-index PHP-Wasm route without trusting its producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexPhpWasmCiRecords
	, parseCheckedRecordValueIndexPhpWasmCiArgs
} from "../tests/helpers/checked-record-value-index-php-wasm-ci-report.mjs";

const selected = parseCheckedRecordValueIndexPhpWasmCiArgs(process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8");
const directory = await realpath(selected.directory);
const read = async path => {
	assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	const file = join(directory, path); assert.equal(await realpath(file), file); return readFile(file);
};
process.stdout.write(canonicalJson(await checkCheckedRecordValueIndexPhpWasmCiRecords(selected, {
	tap, read
})));
