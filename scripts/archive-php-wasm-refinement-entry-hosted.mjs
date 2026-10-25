#!/usr/bin/env node
/**
 * Archive a complete terminal PHP-Wasm matrix using original input files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { archivePhpWasmEntryHostedMatrix } from "../tests/helpers/php-wasm-refinement-entry-hosted-archive.mjs";

const usage = "Usage: archive-php-wasm-refinement-entry-hosted.mjs --selection <absolute-json> --output <fresh-absolute-directory> --producer-checkout <exact-absolute-worktree>";
const args = process.argv.slice(2), selected = {};
assert.equal(args.length, 6, usage);
for(let index = 0; index < args.length; index += 2)
{
	const flag = args[index], value = args[index + 1];
	assert.ok(["--selection", "--output", "--producer-checkout"].includes(flag)
		&& !Object.hasOwn(selected, flag), usage);
	assert.ok(typeof value === "string" && isAbsolute(value) && resolve(value) === value, usage);
	selected[flag] = value;
}
assert.equal(await realpath(selected["--selection"]), selected["--selection"]);
const information = await lstat(selected["--selection"]);
assert.ok(information.isFile() && information.size > 0 && information.size <= 1024 ** 2);
const selection = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readFile(selected["--selection"])));
process.stdout.write(canonicalJson(await archivePhpWasmEntryHostedMatrix(
	selection, selected["--output"], selected["--producer-checkout"]
)));
