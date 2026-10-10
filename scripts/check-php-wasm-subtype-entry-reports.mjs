/**
 * Check both source-free installed instrumented Subtype routes and their retained C inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertPhpWasmSubtypeEntryReport, phpWasmSubtypeEntryReportInput, readPhpWasmSubtypeEntryBuilds } from "../tests/helpers/php-wasm-subtype-entry-report.mjs";

const [flag, directory, ...extra] = process.argv.slice(2);
assert.ok(flag === "--directory" && directory && !directory.startsWith("--") && extra.length === 0,
	"Usage: check-php-wasm-subtype-entry-reports.mjs --directory <report-directory>");
const input = await phpWasmSubtypeEntryReportInput();
for(const route of ["ordinary", "reviewed"])
{
	const root = join(directory, route);
	assertPhpWasmSubtypeEntryReport(JSON.parse(await readFile(join(root, "report.json"))), route, input, await readPhpWasmSubtypeEntryBuilds(root));
}
process.stdout.write("PHP-Wasm Subtype entry probes verified: ordinary/reviewed, 24 Node/Chromium configurations, 2024 assertions and 2030 measured calls each, plus unrefined controls. Separate instrumented packages; no unmodified-release entry claim.\n");
