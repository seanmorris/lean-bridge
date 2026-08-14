#!/usr/bin/env node
/**
 * Generates the value frame workflow.
 *
 * @file
 */


import { readFile } from "node:fs/promises";

import { emitValueFrameV1CHeader } from "../src/abi/value-frame.mjs";

const args = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const flag = process.argv[index];
	const value = process.argv[index + 1];
	if(!flag?.startsWith("--") || value === undefined)
	{
		throw new Error("arguments must use --name value pairs");
	}
	args.set(flag.slice(2), value);
}

for(const required of ["ir", "declaration"])
{
	if(!args.has(required)) throw new Error(`missing --${required}`);
}

const integer = (name, fallback) => {
	const value = Number(args.get(name) ?? fallback);
	if(!Number.isSafeInteger(value) || value < 1)
	{
		throw new Error(`--${name} must be a positive safe integer`);
	}
	return value;
};

const ir = JSON.parse(await readFile(args.get("ir"), "utf8"));
const source = emitValueFrameV1CHeader(ir, args.get("declaration"), {
	abiVersion: integer("abi-version", 1)
	, maxCopyBytes: integer("max-copy-bytes", 1024 * 1024)
	, maxArrayLength: integer("max-array-length", 64 * 1024)
});
process.stdout.write(source);
