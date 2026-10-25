#!/usr/bin/env node
/**
 * Independently reconstruct and replay a complete retained PHP-Wasm matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkPhpWasmEntryHostedArchive } from "../tests/helpers/php-wasm-refinement-entry-hosted-archive.mjs";

const usage = "Usage: check-php-wasm-refinement-entry-hosted-archive.mjs --directory <absolute-archive> --producer-checkout <exact-absolute-worktree>";
const args = process.argv.slice(2), selected = {};
assert.equal(args.length, 4, usage);
for(let index = 0; index < args.length; index += 2)
{
	const flag = args[index], value = args[index + 1];
	assert.ok(["--directory", "--producer-checkout"].includes(flag)
		&& !Object.hasOwn(selected, flag), usage);
	assert.ok(typeof value === "string" && isAbsolute(value) && resolve(value) === value, usage);
	selected[flag] = value;
}
process.stdout.write(canonicalJson(await checkPhpWasmEntryHostedArchive(
	selected["--directory"], selected["--producer-checkout"]
)));
