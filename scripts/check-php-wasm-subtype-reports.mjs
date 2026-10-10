/**
 * Require complete ordinary and reviewed installed Subtype reports in CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertPhpWasmSubtypeReport, phpWasmSubtypeReportInput } from "../tests/helpers/php-wasm-subtype-report.mjs";

const [flag, directory, ...extra] = process.argv.slice(2);
assert.ok(flag === "--directory" && directory && !directory.startsWith("--") && extra.length === 0,
	"Usage: check-php-wasm-subtype-reports.mjs --directory <report-directory>");
const input = await phpWasmSubtypeReportInput();
for(const route of ["ordinary", "reviewed"])
	assertPhpWasmSubtypeReport(JSON.parse(await readFile(join(directory, `${route}.json`), "utf8")), `${route}-source`, input);
process.stdout.write("PHP-Wasm Subtype reports verified: both source routes, all 24 executions, 2024 checks each. Constructor and source dispatch are not measured.\n");
