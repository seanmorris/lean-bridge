#!/usr/bin/env node
/**
 * Assemble pinned JavaScript author headers without publishing anything.
 *
 * @file
 */
import { buildJavaScriptWasmCompilerInputs } from "../src/release/javascript-wasm-compiler-inputs.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index], value = process.argv[index + 1];
	if(!["--target-runtime", "--output"].includes(name) || options.has(name) || !value || value.startsWith("--"))
		throw new Error("Usage: build-javascript-wasm-compiler-inputs.mjs --target-runtime PINNED_BROWSER_RUNTIME --output NEW_DIRECTORY");
	options.set(name, value);
}
if(options.size !== 2) throw new Error("Both --target-runtime and --output are required");
const result = await buildJavaScriptWasmCompilerInputs({ leanRuntimeRoot: options.get("--target-runtime"), outputRoot: options.get("--output") });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
