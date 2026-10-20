#!/usr/bin/env node
/**
 * Verify the original callback Subtype browser producer output.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkCallbackSubtypeBrowserCi
	, checkCallbackSubtypeBrowserRecords
	, parseCallbackSubtypeBrowserCiArgs
} from "../tests/helpers/callback-subtype-browser-ci.mjs";

const selected = parseCallbackSubtypeBrowserCiArgs(process.argv.slice(2));
const checked = checkCallbackSubtypeBrowserCi(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: JSON.parse(await readFile(selected.runtime, "utf8"))
});
const records = await checkCallbackSubtypeBrowserRecords(
	selected.records, selected.producer
);
process.stdout.write(canonicalJson({ ...checked, records }));
