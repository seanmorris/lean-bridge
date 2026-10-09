/**
 * Check one completed reviewed Fin Wasm entry CI leg (VO #1438): pass the run directory and --mode=<original|probe>.
 * Coverage is declared here, never read from the reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { checkWasmEntryCiRun, wasmEntryCiReports } from "../tests/helpers/reviewed-fin-wasm-entry-ci.mjs";
import { recountReviewedFinWasmEntryReport } from "../tests/helpers/reviewed-fin-wasm-entry-producer.mjs";
import { expectReviewedFinWasmEntry } from "../tests/helpers/reviewed-fin-wasm-entry.mjs";

const [directory, option, ...rest] = process.argv.slice(2);
assert.ok(directory && option?.startsWith("--mode=") && !rest.length, "Usage: check-reviewed-fin-wasm-entry-run.mjs <run directory> --mode=<original|probe>");
const mode = option.slice("--mode=".length);
const files = await readdir(directory);
const bytes = Object.fromEntries(await Promise.all(wasmEntryCiReports(mode).filter(name => files.includes(`${name}.json`)).map(async name => [name, await readFile(join(directory, `${name}.json`))])));
const summary = await checkWasmEntryCiRun({ mode
	, tap: await readFile(join(directory, "run.tap"), "utf8")
	, files
	, reports: Object.fromEntries(Object.entries(bytes).map(([name, content]) => [name, JSON.parse(content)]))
	, recount: async (report, reportMode, selection, engines) => recountReviewedFinWasmEntryReport(report, await expectReviewedFinWasmEntry(selection, reportMode), { engines: [...engines] }) });
process.stdout.write(`Wasm entry ${mode} leg accounted: ${Object.entries(summary).map(([name, runs]) => `${name} ${runs} runs sha256 ${sha256(bytes[name])}`).join("; ")}\n`);
