/**
 * Check a completed source-entry probe run directory (VO #1430): run.tap, report.json and calls/. Pass the
 * run directory, and optionally --inputs= a directory holding each ABI's archived instrumented inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertSourceEntryRun } from "../tests/helpers/scalar-fin-source-entry-run.mjs";
import { sourceEntryControl } from "../tests/helpers/scalar-fin-source-entry.mjs";

const [directory, ...options] = process.argv.slice(2);
assert.ok(directory && options.every(option => option.startsWith("--inputs=")), "Usage: check-scalar-fin-source-entry-run.mjs <run directory> [--inputs=<directory>]");
const inputsDirectory = options[0]?.slice("--inputs=".length);
const read = name => readFile(join(directory, name));
const archivedInputs = new Map();
if(inputsDirectory)
	for(const abi of ["scalar", "callable", "copied", "record", "compound", "nominal"])
	{
		const lean = await readFile(join(inputsDirectory, `${abi}.lean.txt`), "utf8");
		const names = [...lean.matchAll(/^def (\w+) .* := dbgTrace "lean-bridge-source-entry \1" fun _ => /gmu)].map(match => match[1]);
		assert.ok(names.includes(sourceEntryControl), abi);
		archivedInputs.set(abi, { lean, names, consumer: await readFile(join(inputsDirectory, `${abi}.consumer.mjs.txt`), "utf8") });
	}
const summary = await assertSourceEntryRun({
	tap: await readFile(join(directory, "run.tap"), "utf8")
	, report: await readFile(join(directory, "report.json"), "utf8")
	, read
	, ...inputsDirectory ? { inputs: abi => archivedInputs.get(abi) } : {}
});
process.stdout.write(`Source-entry run accounted: ${Object.entries(summary).map(([abi, item]) => `${abi} ${item.calls} calls, ${item.entered} entered`).join("; ")}\n`);
