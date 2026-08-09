#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { comparePerformanceCandidate } from "../src/performance/budgets.mjs";

const options = { baseline: null, candidate: null, budget: null, output: null };
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--baseline") options.baseline = resolve(process.argv[++index]);
  else if (argument === "--candidate") options.candidate = resolve(process.argv[++index]);
  else if (argument === "--budget") options.budget = resolve(process.argv[++index]);
  else if (argument === "--output") options.output = resolve(process.argv[++index]);
  else throw new Error(`unknown performance regression option ${argument}`);
}
if (!options.baseline || !options.candidate || !options.budget) {
  throw new Error("--baseline, --candidate, and --budget are required");
}
const baselineBytes = await readFile(options.baseline);
const [baseline, candidate, budget] = await Promise.all([
  Promise.resolve(JSON.parse(baselineBytes)),
  readFile(options.candidate, "utf8").then(JSON.parse),
  readFile(options.budget, "utf8").then(JSON.parse),
]);
const report = comparePerformanceCandidate({
  baseline,
  candidate,
  budget,
  baselineSha256: createHash("sha256").update(baselineBytes).digest("hex"),
});
const output = `${JSON.stringify(report, null, 2)}\n`;
if (options.output) {
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, output);
} else process.stdout.write(output);
if (!report.accepted) process.exitCode = 1;
