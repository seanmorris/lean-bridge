#!/usr/bin/env node
/**
 * Compares the component engine outputs workflow.
 *
 * @file
 */


import { canonicalJson } from "../src/capsule/node.mjs";
import { compareComponentEngineOutputs } from "../src/build/engine-output-comparison.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const flag = process.argv[index];
	const value = process.argv[index + 1];
	if(!new Set(["--native", "--docker"]).has(flag) || value === undefined || options.has(flag)) throw new Error(`unknown, duplicate, or incomplete argument ${flag ?? ""}`);
	options.set(flag, value);
}
for(const required of ["--native", "--docker"]) if(!options.has(required)) throw new Error(`missing ${required}`);

const report = await compareComponentEngineOutputs({
	nativeRoot: options.get("--native")
	, dockerRoot: options.get("--docker")
});
process.stdout.write(canonicalJson(report));
