/**
 * Inspect explicitly selected WIT compiler and runtime inputs before package production.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson } from "../src/capsule/node.mjs";
import { nominalSubtypeWitToolSelection, inspectNominalSubtypeWitTools } from "../tests/helpers/nominal-subtype-wit-tools.mjs";

const args = process.argv.slice(2);
assert.equal(args.length, 4, "Usage: select-nominal-subtype-wit-ci-tools.mjs /absolute/cc /absolute/wasm-tools /absolute/capi <output-directory>");
const [cc, wasmTools, wasmtimeCapi, directory] = args;
const selected = nominalSubtypeWitToolSelection({ CC: cc, LEAN_BRIDGE_WASM_TOOLS: wasmTools, LEAN_BRIDGE_WASMTIME_C_API: wasmtimeCapi });
process.stdout.write(canonicalJson(await inspectNominalSubtypeWitTools(selected, directory)));
