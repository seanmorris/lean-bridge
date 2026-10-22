#!/usr/bin/env node
/**
 * Verify original retained checked callback PHP-Wasm route records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	checkCallbackRefinementsPhpWasmReport
} from "../tests/helpers/callback-refinements-php-wasm-report.mjs";

const args = process.argv.slice(2), option = name => {
	const index = args.indexOf(name);
	assert.ok(index >= 0 && args[index + 1], `Missing ${name}`);
	return args[index + 1];
};
const directory = resolve(option("--directory")), producerCommit = option("--producer");
assert.equal(args.length, 4);
const results = [];
for(const profile of ["fin", "checked-record"])
	for(const route of ["ordinary", "reviewed"])
		results.push(await checkCallbackRefinementsPhpWasmReport(
			path => readFile(`${directory}/${profile}/${route}/${path}`)
			, { profile, route, producerCommit }
		));
process.stdout.write(JSON.stringify({ schemaVersion: 1, results }) + "\n");
