#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPerformanceEvidenceBundle } from "../src/performance/evidence-bundle.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowed = new Set(["--report", "--summary", "--validation", "--output"]);
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index];
  const value = process.argv[index + 1];
  if (!allowed.has(flag) || value === undefined) throw new Error(`unknown or incomplete argument ${flag ?? ""}`);
  options.set(flag, value);
}
for (const required of allowed) {
  if (!options.has(required)) throw new Error(`missing ${required}`);
}

const result = await buildPerformanceEvidenceBundle({
  projectRoot,
  reportPath: options.get("--report"),
  summaryPath: options.get("--summary"),
  validationPath: options.get("--validation"),
  outputRoot: options.get("--output"),
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
