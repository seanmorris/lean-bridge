/**
 * Verify a current installed Fin container edge selection before CI accepts or archives it.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertFinContainerEdgeReport } from "../tests/helpers/fin-container-edge-report.mjs";

const [selected, path, ...options] = process.argv.slice(2);
assert.ok(selected && path && (options.length === 0 || (options.length === 2 && options[0] === "--python")),
	"Usage: check-fin-container-edge-report.mjs <profile,...> <report.json> [--python 3.11|3.12]");
const profiles = selected.split(",");
await assertFinContainerEdgeReport(JSON.parse(await readFile(path, "utf8")), profiles, { python: options[1] });
process.stdout.write(`Fin container raw and public entry measurements verified for ${profiles.join(", ")}.\n`);
