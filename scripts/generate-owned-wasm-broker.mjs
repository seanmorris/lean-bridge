#!/usr/bin/env node
/**
 * Emit shared-heap ownership support for the prepared Emscripten runtime.
 *
 * @file
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { generateOwnedWasmBroker } from "../src/backends/javascript/owned-wasm-broker.mjs";

if(process.argv.length !== 3) throw new Error("Usage: generate-owned-wasm-broker.mjs OUTPUT_DIRECTORY");
const directory = resolve(process.argv[2]), broker = generateOwnedWasmBroker();
await mkdir(directory, { recursive: true });
await writeFile(join(directory, "owned-runtime.c"), broker.source);
await writeFile(join(directory, "lean_bridge_native_runtime.h"), broker.header);
await writeFile(join(directory, "owned-runtime-exports.txt"), [...broker.exports, ...broker.supportExports].map(name => "_" + name).sort().join("\n") + "\n");
