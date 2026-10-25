#!/usr/bin/env node
/**
 * Preserve original PHP-Wasm diagnostics without granting matrix acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { parseCheckedRecordValueIndexHostedArchiveArgs } from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";
import { archivePhpWasmEntryHostedDiagnostic } from "../tests/helpers/php-wasm-refinement-entry-hosted-diagnostic.mjs";

const usage = "Usage: archive-php-wasm-entry-hosted-diagnostic.mjs --output <fresh-absolute-directory> --run-json <file> --job-json <file> --artifact-json <file> --artifact-zip <file>";
const [flag, destination, ...args] = process.argv.slice(2);
assert.equal(flag, "--output", usage);
assert.ok(typeof destination === "string" && isAbsolute(destination) && resolve(destination) === destination, usage);
const selected = parseCheckedRecordValueIndexHostedArchiveArgs(args, usage);
process.stdout.write(canonicalJson(await archivePhpWasmEntryHostedDiagnostic(selected, destination)));
