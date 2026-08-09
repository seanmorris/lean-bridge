#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildNpmPackage } from "../src/release/npm-package.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowed = new Set(["--bundle", "--output"]);
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index];
  const value = process.argv[index + 1];
  if (!allowed.has(flag) || value === undefined) throw new Error(`unknown or incomplete argument ${flag ?? ""}`);
  options.set(flag, value);
}
for (const required of ["--bundle", "--output"]) {
  if (!options.has(required)) throw new Error(`missing ${required}`);
}

const result = await buildNpmPackage({
  bundleRoot: resolve(projectRoot, options.get("--bundle")),
  outputRoot: resolve(projectRoot, options.get("--output")),
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
