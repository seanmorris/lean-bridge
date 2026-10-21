#!/usr/bin/env node
/**
 * Refuse skipped, partial, or substituted fresh-Lean zero-payload compiler runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertZeroPayloadPhpWasmCompilerTap } from "../tests/helpers/zero-payload-checked-record-php-wasm-ci-report.mjs";

const args = process.argv.slice(2);
assert.ok(args.length === 1 && args[0].length && !args[0].startsWith("--")
	&& !args[0].includes("\0"), "Usage: check-zero-payload-checked-record-php-wasm-compiler-ci.mjs <original-tap>");
assertZeroPayloadPhpWasmCompilerTap(await readFile(args[0], "utf8"));
process.stdout.write("Four fresh-Lean zero-payload PHP-Wasm compiler tests passed without skips.\n");
