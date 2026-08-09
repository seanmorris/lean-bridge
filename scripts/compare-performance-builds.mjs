#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  collectPerformanceInventory,
  comparePerformanceInventories,
} from "../src/performance/reproducibility.mjs";

const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  if (!name?.startsWith("--") || value === undefined) throw new Error(`invalid option ${name ?? ""}`);
  options.set(name, value);
}
if (!options.has("--build-a") || !options.has("--build-b")) {
  throw new Error("--build-a and --build-b are required");
}
const result = comparePerformanceInventories(
  await collectPerformanceInventory(resolve(options.get("--build-a"))),
  await collectPerformanceInventory(resolve(options.get("--build-b"))),
);
const output = `${JSON.stringify(result, null, 2)}\n`;
if (options.has("--output")) {
  const path = resolve(options.get("--output"));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, output);
} else process.stdout.write(output);
if (!result.accepted) process.exitCode = 1;
