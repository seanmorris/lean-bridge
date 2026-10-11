/**
 * Validate an installed late-input report and its original TAP with explicit host expectations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { finContainerEdgeSelection } from "../tests/helpers/fin-container-edge-install.mjs";
import { assertFinLateTap, readFinLateReport } from "../tests/helpers/fin-container-late-report.mjs";

const { values } = parseArgs({ options: {
	report: { type: "string" }, tap: { type: "string" }
	, profiles: { type: "string" }, python: { type: "string" }
	, glibc: { type: "string" }
} });
for(const name of ["report", "tap", "profiles", "glibc"]) assert.ok(values[name], `--${name} is required`);
assertFinLateTap(await readFile(values.tap, "utf8"));
const result = await readFinLateReport(values.report, finContainerEdgeSelection(values.profiles), { python: values.python, glibc: values.glibc });
process.stdout.write(JSON.stringify(result) + "\n");
