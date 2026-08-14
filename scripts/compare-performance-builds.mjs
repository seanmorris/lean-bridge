#!/usr/bin/env node
/**
 * Compares the performance builds workflow.
 *
 * @file
 */


import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
	collectPerformanceInventory,
	comparePerformanceInventories,
} from "../src/performance/reproducibility.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	const value = process.argv[index + 1];
	if(!name?.startsWith("--") || value === undefined) throw new Error(`invalid option ${name ?? ""}`);
	options.set(name, value);
}
if(!options.has("--build-a") || !options.has("--build-b"))
{
	throw new Error("--build-a and --build-b are required");
}
const comparison = comparePerformanceInventories(
	await collectPerformanceInventory(resolve(options.get("--build-a"))),
	await collectPerformanceInventory(resolve(options.get("--build-b"))),
);
const result = Object.freeze({
	schemaVersion: 1
	, kind: "lean-bridge-performance-build-reproducibility"
	, recordedAt: new Date().toISOString()
	, source: Object.freeze({
		commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
		, dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0
	}),
	...comparison
});
const output = `${JSON.stringify(result, null, 2)}\n`;
if(options.has("--output"))
{
	const path = resolve(options.get("--output"));
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, output);
} else process.stdout.write(output);
if(!result.accepted) process.exitCode = 1;
