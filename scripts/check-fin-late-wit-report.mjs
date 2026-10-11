/**
 * Validate the installed WIT late-input TAP and original records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { assertFinLateWitTap, readFinLateWitRecords } from "../tests/helpers/fin-container-late-wit-report.mjs";

const { values } = parseArgs({ options: {
	directory: { type: "string" }, tap: { type: "string" }
	, glibc: { type: "string" }
} });
for(const key of ["directory", "tap", "glibc"]) assert.ok(values[key], `--${key} is required`);
assertFinLateWitTap(await readFile(values.tap, "utf8"));
const { report, files } = await readFinLateWitRecords(values.directory, values.glibc);
process.stdout.write(JSON.stringify({ profile: report.profile, checks: report.checks, records: files.size }) + "\n");
