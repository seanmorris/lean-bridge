#!/usr/bin/env node
/**
 * Benchmarks the spatial runtime workflow.
 *
 * @file
 */


import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { performanceProfiles, runPerformanceSuite } from "../src/performance/harness.mjs";

const options = {
	workload: "interactive-clustered-2d"
	, profiles: ["lazy", "startup", "final-static", "islands"]
	, output: null
};

for(let index = 2; index < process.argv.length; index += 1)
{
	const argument = process.argv[index];
	if(argument === "--workload") options.workload = process.argv[++index];
	else if(argument === "--profiles") options.profiles = process.argv[++index].split(",");
  else if(argument === "--output") options.output = resolve(process.argv[++index]);
  else throw new Error(`unknown benchmark option ${argument}`);
}
for(const profile of options.profiles)
{
	if(!performanceProfiles.includes(profile)) throw new Error(`unknown performance profile ${profile}`);
}

const manifest = JSON.parse(await readFile(
	new URL("../poc/performance/workloads.v1.json", import.meta.url),
	"utf8",
));
const result = await runPerformanceSuite({
	manifest
	, workload: options.workload
	, profiles: options.profiles
});
const output = `${JSON.stringify(result, null, 2)}\n`;
if(options.output)
{
	await mkdir(dirname(options.output), { recursive: true });
	await writeFile(options.output, output);
} else
{
	process.stdout.write(output);
}
