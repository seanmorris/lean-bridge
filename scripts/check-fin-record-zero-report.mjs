/**
 * Require the ordinary and reviewed Fin 0 nominal collection reports for one CI selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertFinRecordZeroReport } from "../tests/helpers/fin-record-zero-report.mjs";

const [selected, ordinary, reviewed, ...extra] = process.argv.slice(2);
assert.ok(selected && ordinary && reviewed && extra.length === 0,
	"Usage: check-fin-record-zero-report.mjs <profile,...> <ordinary.json> <reviewed.json>");
const profiles = selected.split(",");
await assertFinRecordZeroReport(JSON.parse(await readFile(ordinary, "utf8")), profiles, "ordinary-source");
await assertFinRecordZeroReport(JSON.parse(await readFile(reviewed, "utf8")), profiles, "reviewed-ir");
process.stdout.write(`Fin 0 nominal collection installed reports verified for ${profiles.join(", ")} on both source routes.\n`);
