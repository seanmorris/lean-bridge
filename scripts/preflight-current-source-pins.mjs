#!/usr/bin/env node
/**
 * Report every stale, missing or conflicting current-source pin of the type
 * inventory in one run, and exit 1 when any exists. Nothing is written; the
 * refresh scripts own that step.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	auditCurrentSourcePins, formatCurrentSourcePinPreflight
	, previewCurrentSourcePinRefresh
} from "../tests/helpers/current-source-pin-preflight.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: preflight-current-source-pins.mjs");
const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const report = await auditCurrentSourcePins(inventory);
const preview = previewCurrentSourcePinRefresh(inventory, report);
process.stdout.write(`${formatCurrentSourcePinPreflight(report, preview)}\n`);
process.exitCode = report.findings.length === 0 ? 0 : 1;
