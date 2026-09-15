#!/usr/bin/env node
/**
 * Prepares the standalone Lean Bridge CLI tarball without publishing it.
 *
 * @file
 */

import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	const value = process.argv[index + 1];
	if(!["--output", "--runtime", "--php-wasm-inputs"].includes(name) || options.has(name) || !value || value.startsWith("--"))
		throw new Error("Usage: build-cli-npm-package.mjs --output NEW_DIRECTORY [--runtime PREBUILT_RUNTIME] [--php-wasm-inputs PREPARED_DIRECTORY]");
	options.set(name, value);
}
const result = await buildCliNpmPackage({ outputRoot: options.get("--output"), runtimeRoot: options.get("--runtime") ?? null, phpWasmInputsRoot: options.get("--php-wasm-inputs") ?? null });
process.stdout.write(`${JSON.stringify({
	output: result.output
	, package: result.report.package
	, archive: result.report.archive
	, runtimeIncluded: result.report.runtimeIncluded
	, phpWasmInputsIncluded: result.report.phpWasmInputsIncluded
	, productionApproved: result.report.productionApproved
	, externalRegistryWrites: false
}, null, 2)}\n`);
