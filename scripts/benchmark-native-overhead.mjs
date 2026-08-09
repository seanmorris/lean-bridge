#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { runNativeOverheadSuite } from "../src/performance/overhead.mjs";

let outputPath = null;
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--output") outputPath = resolve(process.argv[++index]);
  else throw new Error(`unknown native overhead option ${argument}`);
}

const result = await runNativeOverheadSuite();
const output = `${JSON.stringify(result, null, 2)}\n`;
if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
} else {
  process.stdout.write(output);
}
