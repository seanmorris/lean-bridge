#!/usr/bin/env node
/**
 * Independently verify installed native PHP or PHP-Wasm HostNull evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertHostNullPhpReport } from "../tests/helpers/host-null-php-report.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
	options.set(process.argv[index], process.argv[index + 1]);
assert.deepEqual([...options.keys()].sort(), [...options.keys()].filter(key => ["--packages", "--profile", "--report"].includes(key)).sort(), "Unknown HostNull report checker option");
assert.ok(options.get("--profile") && options.get("--report") && process.argv.length % 2 === 0,
	"Usage: check-host-null-php-reports.mjs --profile <php-native|php-wasm> --report <report.json> [--packages <handoff-root>]");
const report = JSON.parse(await readFile(options.get("--report"), "utf8"));
const result = await assertHostNullPhpReport(report, options.get("--profile"), options.get("--packages") ?? null);
process.stdout.write(`${JSON.stringify(result)}\n`);
