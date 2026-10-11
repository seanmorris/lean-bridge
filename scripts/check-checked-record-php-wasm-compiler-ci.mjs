/**
 * Refuse skipped, partial or substituted fresh-Lean checked-record compiler runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertCheckedRecordPhpWasmCompilerTap } from "../tests/helpers/checked-record-php-wasm-ci-report.mjs";

const args = process.argv.slice(2);
assert.ok(args.length === 1 && args[0].length && !args[0].startsWith("--") && !args[0].includes("\0"), "Usage: check-checked-record-php-wasm-compiler-ci.mjs <original-tap>");
assertCheckedRecordPhpWasmCompilerTap(await readFile(args[0], "utf8"));
process.stdout.write("Nine fresh-Lean checked-record compiler and reconciliation tests passed without skips.\n");
