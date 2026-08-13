#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJson } from "../src/capsule/node.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";

const allowed = new Set(["--request", "--component", "--output", "--engine", "--backend"]);
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const flag = process.argv[index];
	const value = process.argv[index + 1];
	if(!allowed.has(flag) || value === undefined || options.has(flag)) throw new Error(`unknown, duplicate, or incomplete argument ${flag ?? ""}`);
	options.set(flag, value);
}
for(const required of ["--request", "--component", "--output"]) if(!options.has(required)) throw new Error(`missing ${required}`);

const engineRoot = resolve(options.get("--engine") ?? fileURLToPath(new URL("..", import.meta.url)));
const result = await executeComponentEngineRequest({
	requestPath: resolve(options.get("--request"))
	, inputRoot: resolve(options.get("--component"))
	, outputRoot: resolve(options.get("--output"))
	, engineRoot
	, backend: options.get("--backend") ?? process.env.LEAN_BRIDGE_EXECUTION_BACKEND ?? "direct"
});
process.stdout.write(canonicalJson({
	output: result.output
	, component: result.report.component
	, requestSha256: result.report.requestSha256
	, bundleManifestSha256: result.report.bundleManifestSha256
}));
