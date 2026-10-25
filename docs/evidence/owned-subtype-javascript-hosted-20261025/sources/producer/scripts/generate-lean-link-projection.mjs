#!/usr/bin/env node
/**
 * Generates the Lean link projection workflow.
 *
 * @file
 */


import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import bindingIr from "../poc/lean-link-spike/bindings/alpha.binding-ir.json" with { type: "json" };
import { alphaPrivateAbi } from "../poc/lean-link-spike/private-abi.mjs";
import { compileJavaScriptProjection } from "../src/backends/javascript/projection.mjs";

const output = resolve("poc/lean-link-spike/bindings/alpha.javascript-projection.json");
const projection = compileJavaScriptProjection(bindingIr, alphaPrivateAbi);

await writeFile(output, `${JSON.stringify(projection, null, 2)}\n`);
