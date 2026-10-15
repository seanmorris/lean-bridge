#!/usr/bin/env node
/**
 * Write the evidence-backed recursive checked-Subtype PHP-Wasm inventory once.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
	promoteRecursiveSubtypePhpWasm
	, recursiveSubtypePhpWasmInventoryText
	, recursiveSubtypePhpWasmReferences
} from "../tests/helpers/recursive-subtype-php-wasm-promotion.mjs";
import { recursiveSubtypePhpWasmProducer } from "../tests/helpers/recursive-subtype-php-wasm-evidence.mjs";

assert.equal(process.argv.length, 2, "The one-shot promotion takes no arguments");
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
	recursiveSubtypePhpWasmProducer, "Recursive checked PHP-Wasm promotion is draft-only at its producer commit");
const path = "docs/type-surface.v1.json";
const original = JSON.parse(execFileSync("git", ["show", `${recursiveSubtypePhpWasmProducer}:${path}`],
	{ encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
assert.deepEqual(JSON.parse(await readFile(path, "utf8")), original,
	"Refuse to promote over a changed type-surface inventory");
const references = await recursiveSubtypePhpWasmReferences();
const promoted = await promoteRecursiveSubtypePhpWasm(original, references);
await writeFile(path, recursiveSubtypePhpWasmInventoryText(promoted));
process.stdout.write(`Added ${references.length} installed receipts and supplemented six PHP-Wasm Subtype cells.\n`);
