#!/usr/bin/env node
/**
 * Generates the WIT workflow.
 *
 * @file
 */


import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import { parseBindingIr } from "../src/binding-ir/canonical.mjs";
import { generateWitPackage } from "../src/backends/wit/generate.mjs";

const run = promisify(execFile);
const options = {
	ir: "poc/lean-link-spike/bindings/alpha.binding-ir.json"
	, output: "build/wit-probe"
	, json: false
};

for(let index = 2; index < process.argv.length; index += 1)
{
	const argument = process.argv[index];
	if(argument === "--json")
	{
		options.json = true;
		continue;
	}
	if(argument === "--ir" || argument === "--output")
	{
		const value = process.argv[index + 1];
		if(!value) throw new Error(`${argument} requires a value`);
		options[argument.slice(2)] = value;
		index += 1;
		continue;
	}
	throw new Error(`unknown argument ${argument}`);
}

const irPath = resolve(options.ir);
const output = resolve(options.output);
const project = resolve(".");
if(output === project || output === dirname(project))
{
	throw new Error("refusing to use the project root or its parent as WIT output");
}

const ir = parseBindingIr(await readFile(irPath, "utf8"));
const generated = generateWitPackage(ir);
for(const [relativePath, source] of Object.entries(generated.files))
{
	const destination = resolve(output, relativePath);
	if(!destination.startsWith(`${output}/`)) throw new Error(`unsafe generated path ${relativePath}`);
	await mkdir(dirname(destination), { recursive: true });
	await writeFile(destination, source);
}

const witPath = resolve(output, `wit/${generated.manifest.wit.world}.wit`);
await run("wasm-tools", ["component", "wit", witPath, "--json"]);

const result = {
	schemaVersion: 1
	, status: "generated"
	, output
	, bindingIrSha256: generated.manifest.bindingIrSha256
	, witPackage: generated.manifest.wit.package
	, world: generated.manifest.wit.world
	, declarations: generated.manifest.declarations.length
	, deferred: generated.manifest.deferred
};
if(options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
else process.stdout.write(`Generated ${result.witPackage}/${result.world} with ${result.declarations} declarations in ${output}\n`);
