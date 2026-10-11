/**
 * Check one original installed checked-record browser run and every required record.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { parseCheckedRecordBrowserCiArgs, checkCheckedRecordBrowserCiRecords } from "../tests/helpers/checked-record-browser-ci-report.mjs";

const selected = parseCheckedRecordBrowserCiArgs(process.argv.slice(2));
const result = await checkCheckedRecordBrowserCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, read: path => {
		assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(selected.directory, path));
	}
});
process.stdout.write(canonicalJson(result));
