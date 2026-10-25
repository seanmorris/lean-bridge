#!/usr/bin/env node
/**
 * Reconstruct an original diagnostic archive independently from its downloads.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkPhpWasmEntryHostedDiagnosticArchive } from "../tests/helpers/php-wasm-refinement-entry-hosted-diagnostic.mjs";

const args = process.argv.slice(2);
assert.ok(args.length === 2 && args[0] === "--directory"
	&& isAbsolute(args[1]) && resolve(args[1]) === args[1]
, "Usage: check-php-wasm-entry-hosted-diagnostic.mjs --directory <absolute-archive-directory>");
process.stdout.write(canonicalJson(await checkPhpWasmEntryHostedDiagnosticArchive(args[1])));
