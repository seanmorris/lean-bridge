/**
 * Require one complete installed recursive checked-record PHP-Wasm selection, independent host
 * evidence and every corruption control.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir, realpath } from "node:fs/promises";
import { join, relative } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordPhpWasmCiRecords, parseRecursiveCheckedRecordPhpWasmCiArgs } from "../tests/helpers/recursive-checked-record-php-wasm-ci-report.mjs";

const selected = parseRecursiveCheckedRecordPhpWasmCiArgs(process.argv.slice(2));
const root = await realpath(selected.directory), records = new Map();
const collect = async directory => {
	for(const entry of await readdir(directory, { withFileTypes: true }))
	{
		const path = join(directory, entry.name);
		if(entry.isDirectory()) await collect(path);
		else
		{
			assert.ok(entry.isFile() && !entry.isSymbolicLink(), path);
			records.set(relative(root, path), await readFile(path));
		}
	}
};
await collect(root);
const result = await checkRecursiveCheckedRecordPhpWasmCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: JSON.parse(await readFile(selected.runtime, "utf8"))
	, records
});
process.stdout.write(canonicalJson(result));
