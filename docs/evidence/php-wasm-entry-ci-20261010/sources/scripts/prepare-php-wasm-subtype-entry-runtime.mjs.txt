/**
 * Prepare a fresh shared runtime for the installed entry gate using the job's pinned Lean archives.
 * Never rely on another test's disposable directory or a workstation-only default.
 *
 * @file
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { buildPhpWasmCopiedRuntime } from "../src/build/php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins, readVerifiedPhpWasmCopiedRuntime } from "../src/build/php-wasm-copied-artifacts.mjs";

const [flag, directory, ...extra] = process.argv.slice(2);
assert.ok(flag === "--output" && directory && !directory.startsWith("--") && extra.length === 0,
	"Usage: prepare-php-wasm-subtype-entry-runtime.mjs --output <new-runtime-directory>");
const root = resolve(directory);
await buildPhpWasmCopiedRuntime({ outputRoot: root
	, emsdkRoot: resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm")
	, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`) });
const runtime = await readVerifiedPhpWasmCopiedRuntime(root);
process.stdout.write(JSON.stringify({ root, runtimeIdentity: runtime.identity, library: runtime.manifest.library }) + "\n");
