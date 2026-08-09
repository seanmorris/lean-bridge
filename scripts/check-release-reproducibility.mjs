#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runReproducibilityGate } from "../src/release/reproducibility-gate.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  if (!name?.startsWith("--") || value === undefined) throw new Error(`invalid option ${name ?? ""}`);
  options.set(name, value);
}
const projectRoot = resolve(repositoryRoot, options.get("--project") ?? ".");
const outputRoot = resolve(repositoryRoot, options.get("--output") ?? "build/reproducibility-gate");

const result = await runReproducibilityGate({ projectRoot, outputRoot });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
