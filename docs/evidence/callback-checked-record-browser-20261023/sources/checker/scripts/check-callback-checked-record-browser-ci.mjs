#!/usr/bin/env node
/**
 * Verify the original callback checked-record browser producer output.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkCallbackCheckedRecordBrowserCi
	, checkCallbackCheckedRecordBrowserRecords
	, parseCallbackCheckedRecordBrowserCiArgs
} from "../tests/helpers/callback-checked-record-browser-ci.mjs";

const selected = parseCallbackCheckedRecordBrowserCiArgs(process.argv.slice(2));
const checked = checkCallbackCheckedRecordBrowserCi(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: JSON.parse(await readFile(selected.runtime, "utf8"))
});
const records = await checkCallbackCheckedRecordBrowserRecords(
	selected.records, selected.producer
);
process.stdout.write(canonicalJson({ ...checked, records }));
