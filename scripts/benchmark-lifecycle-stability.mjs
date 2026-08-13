#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { runLifecycleStabilitySuite } from "../src/performance/lifecycle.mjs";

let outputPath = null;
for(let index = 2; index < process.argv.length; index += 1)
{
	const argument = process.argv[index];
	if(argument === "--output") outputPath = resolve(process.argv[++index]);
	else throw new Error(`unknown lifecycle benchmark option ${argument}`);
}

const result = await runLifecycleStabilitySuite();
const output = `${JSON.stringify(result, null, 2)}\n`;
if(outputPath)
{
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, output);
} else
{
	process.stdout.write(output);
}
