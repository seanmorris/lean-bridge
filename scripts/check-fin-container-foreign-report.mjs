/**
 * Require measured malformed foreign carriers alongside the full installed edge report.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertFinForeignReport } from "../tests/helpers/fin-container-foreign-report.mjs";

const [selected, path, ...options] = process.argv.slice(2);
assert.ok(selected && path && (options.length === 0 || (options.length === 2 && options[0] === "--python")),
	"Usage: check-fin-container-foreign-report.mjs <profile,...> <report.json> [--python 3.11|3.12]");
const profiles = selected.split(",");
await assertFinForeignReport(JSON.parse(await readFile(path, "utf8")), profiles, { python: options[1] });
process.stdout.write(`Fin container raw, public and foreign-carrier measurements verified for ${profiles.join(", ")}.\n`);
