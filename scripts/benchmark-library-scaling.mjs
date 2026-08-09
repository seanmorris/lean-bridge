#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  runScalingSuite,
  scalingGraphCounts,
  scalingProfiles,
} from "../src/performance/scaling.mjs";

const options = {
  counts: [...scalingGraphCounts],
  profiles: [...scalingProfiles],
  output: null,
};
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--counts") options.counts = process.argv[++index].split(",").map(Number);
  else if (argument === "--profiles") options.profiles = process.argv[++index].split(",");
  else if (argument === "--output") options.output = resolve(process.argv[++index]);
  else throw new Error(`unknown scaling benchmark option ${argument}`);
}
for (const count of options.counts) {
  if (!scalingGraphCounts.includes(count)) throw new Error(`unsupported graph count ${count}`);
}
for (const profile of options.profiles) {
  if (!scalingProfiles.includes(profile)) throw new Error(`unsupported scaling profile ${profile}`);
}

const result = await runScalingSuite(options);
const output = `${JSON.stringify(result, null, 2)}\n`;
if (options.output) {
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, output);
} else {
  process.stdout.write(output);
}
