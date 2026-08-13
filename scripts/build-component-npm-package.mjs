#!/usr/bin/env node

import { resolve } from "node:path";

import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
for(const required of ["--bundle", "--runtime", "--output"])
{
	if(!options.get(required)) throw new Error(`${required} is required`);
}
const result = await buildComponentNpmPackages({
	bundleRoot: resolve(options.get("--bundle"))
	, runtimeRoot: resolve(options.get("--runtime"))
	, outputRoot: resolve(options.get("--output"))
});
process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
