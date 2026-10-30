#!/usr/bin/env node
/**
 * Verify one original native PHP and PHP-Wasm proof-erasure run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	checkDirectProofErasurePhpRecords
} from "../tests/helpers/direct-proof-erasure-php-report.mjs";

const values = Object.fromEntries(process.argv.slice(2).reduce((items, item, index, all) => {
	if(index % 2 === 0)
	{
		assert.match(item, /^--(?:route|producer|directory|tap)$/u);
		assert.ok(all[index + 1] && !all[index + 1].startsWith("--"));
		items.push([item.slice(2), all[index + 1]]);
	}
	return items;
}, []));
assert.deepEqual(Object.keys(values).sort()
	, ["directory", "producer", "route", "tap"]);
assert.ok(["ordinary", "reviewed"].includes(values.route));
assert.match(values.producer, /^[a-f0-9]{40}$/u);
const directory = resolve(values.directory);
const tap = await readFile(resolve(values.tap), "utf8");
assert.match(tap, /^1\.\.1$/mu);
assert.match(tap, /^# pass 1$/mu);
assert.match(tap, /^# fail 0$/mu);
await verifyPackageSetReceipt({
	receiptPath: join(directory, "handoff/package-set-receipt.json")
});
const result = await checkDirectProofErasurePhpRecords(path => {
	assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	return readFile(join(directory, path));
}, { route: values.route, producerCommit: values.producer, directory });
process.stdout.write(canonicalJson(result));
