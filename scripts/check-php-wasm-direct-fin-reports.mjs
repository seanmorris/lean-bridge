/**
 * Verify both direct Fin source routes before CI retains their original reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertPhpWasmDirectFinReport, phpWasmDirectReportInputs } from "../tests/helpers/php-wasm-fin-direct-report.mjs";

const [flag, directory, ...extra] = process.argv.slice(2);
assert.ok(flag === "--directory" && directory && !directory.startsWith("--") && extra.length === 0,
	"Usage: check-php-wasm-direct-fin-reports.mjs --directory <report-directory>");
const inputs = await phpWasmDirectReportInputs();
for(const route of ["ordinary", "reviewed"])
	assertPhpWasmDirectFinReport(JSON.parse(await readFile(join(directory, `${route}.json`), "utf8")), `${route}-source`, inputs);
process.stdout.write("Direct PHP-Wasm Fin reports verified: both fixtures, both source routes, all 48 executions. Dispatch is not measured.\n");
