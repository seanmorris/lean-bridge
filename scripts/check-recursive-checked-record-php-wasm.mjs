#!/usr/bin/env node
/**
 * Verify one retained recursive checked-record PHP-Wasm selection and run every control.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir, realpath } from "node:fs/promises";
import { join, relative } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordPhpWasmControls } from "../tests/helpers/recursive-checked-record-php-wasm-controls.mjs";
import { recursiveCheckedRecordPhpWasmFixtures, recursiveCheckedRecordPhpWasmRoutes } from "../tests/helpers/recursive-checked-record-php-wasm-fixture.mjs";

const usage = "Usage: check-recursive-checked-record-php-wasm.mjs --route ordinary|reviewed --fixture recursive|mutual --producer <commit> --directory <records>";
const args = process.argv.slice(2), selected = {};
assert.ok(args.length === 8, usage);
for(let index = 0; index < args.length; index += 2)
{
	const key = args[index].slice(2);
	assert.ok(args[index].startsWith("--") && ["route", "fixture", "producer", "directory"].includes(key) && !Object.hasOwn(selected, key), usage);
	selected[key] = args[index + 1];
}
assert.ok(recursiveCheckedRecordPhpWasmRoutes.includes(selected.route), usage);
assert.ok(recursiveCheckedRecordPhpWasmFixtures.includes(selected.fixture), usage);
assert.match(selected.producer ?? "", /^[a-f0-9]{40}$/u, usage);
const root = await realpath(selected.directory);
const originals = new Map();
const collect = async directory => {
	for(const entry of await readdir(directory, { withFileTypes: true }))
	{
		const path = join(directory, entry.name);
		if(entry.isDirectory()) await collect(path);
		else
		{
			assert.ok(entry.isFile() && !entry.isSymbolicLink(), path);
			originals.set(relative(root, path), await readFile(path));
		}
	}
};
await collect(root);
const controls = await checkRecursiveCheckedRecordPhpWasmControls(originals
	, { route: selected.route, fixture: selected.fixture, producerCommit: selected.producer });
process.stdout.write(canonicalJson({ ...selected, records: originals.size, ...controls }) + "\n");
