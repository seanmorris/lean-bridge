#!/usr/bin/env node
/**
 * Builds the universal release bundle workflow.
 *
 * @file
 */


import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowed = new Set(["--core", "--native", "--managed", "--wasi", "--output", "--revision", "--source-date-epoch", "--builder"]);
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const flag = process.argv[index];
	const value = process.argv[index + 1];
	if(!allowed.has(flag) || value === undefined) throw new Error(`unknown or incomplete argument ${flag ?? ""}`);
	options.set(flag, value);
}
for(const required of ["--core", "--output", "--revision"])
{
	if(!options.has(required)) throw new Error(`missing ${required}`);
}
const sourceDateEpoch = Number(options.get("--source-date-epoch") ?? 1786261809);
if(!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch < 1) throw new Error("--source-date-epoch must be a positive integer");

const result = await buildUniversalReleaseBundle({
	projectRoot
	, coreRoot: options.get("--core")
	, nativeRoot: options.get("--native") ?? null
	, managedRoot: options.get("--managed") ?? null
	, wasiRoot: options.get("--wasi") ?? null
	, outputRoot: options.get("--output")
	, revision: options.get("--revision")
	, sourceDateEpoch
	, builder: options.get("--builder") ?? "nix-flake-v1"
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
