#!/usr/bin/env node
/**
 * Authenticate the complete manifest set emitted by hosted Core shards.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	collectCoreContractTestPaths, coreContractShardLabels
	, verifyCoreContractShardManifests
} from "./core-contract-shards.mjs";

assert.equal(process.argv.length, 3
	, "Usage: check-core-contract-shards.mjs <manifest-directory>");
const directory = resolve(process.argv[2]);
const entries = (await readdir(directory, { withFileTypes: true }))
	.filter(entry => !entry.name.startsWith("."));
const expectedNames = coreContractShardLabels.map(label =>
	`core-shard-${label.split("/")[0]}.json`);
assert.deepEqual(entries.map(entry => entry.name).sort(), expectedNames.sort());
assert.ok(entries.every(entry => entry.isFile()));
const manifests = [];
for(const name of expectedNames)
{
	const source = await readFile(resolve(directory, name), "utf8");
	const manifest = JSON.parse(source);
	assert.equal(source, canonicalJson(manifest), `${name} must be canonical`);
	manifests.push(manifest);
}
const result = verifyCoreContractShardManifests(
	await collectCoreContractTestPaths(), manifests);
process.stdout.write(canonicalJson(result));
