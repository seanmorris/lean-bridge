/**
 * Gate one installed selection's FinContainers entry-counter reports (VO #1438): pass its hosts, then the
 * ordinary-source and reviewed-IR reports. A skipped, unobserved, partial or relabelled report fails.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertFinContainerEntryCiReport } from "../tests/helpers/fin-container-entry-ci.mjs";

const [profiles, ordinary, reviewed, ...rest] = process.argv.slice(2);
assert.ok(profiles && ordinary && reviewed && rest.length === 0, "Usage: check-fin-container-entry-reports.mjs <profile,...> <ordinary report> <reviewed report>");
const selected = profiles.split(",");
for(const [path, route] of [[ordinary, "ordinary-source"], [reviewed, "reviewed-ir"]])
	assertFinContainerEntryCiReport(JSON.parse(await readFile(path, "utf8")), selected, route);
process.stdout.write(`FinContainers entry counters observed for ${selected.join(", ")} on both routes.\n`);
