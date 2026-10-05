#!/usr/bin/env node
/**
 * Archive prepared PHP-Wasm author inputs without compiling or publishing them.
 *
 * @file
 */
import { buildPhpWasmCompilerInputs } from "../src/release/php-wasm-compiler-inputs.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index], value = process.argv[index + 1];
	if(!["--runtime", "--php-source", "--output"].includes(name) || options.has(name) || !value || value.startsWith("--"))
		throw new Error("Usage: build-php-wasm-compiler-inputs.mjs --runtime PREBUILT_RUNTIME --php-source CONFIGURED_SOURCE --output NEW_DIRECTORY");
	options.set(name, value);
}
if(options.size !== 3) throw new Error("--runtime, --php-source and --output are required");
process.stdout.write(`${JSON.stringify(await buildPhpWasmCompilerInputs({ runtimeRoot: options.get("--runtime"), phpSource: options.get("--php-source"), outputRoot: options.get("--output") }), null, 2)}\n`);
