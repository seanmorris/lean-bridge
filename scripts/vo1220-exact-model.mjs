#!/usr/bin/env node
/**
 * Create or check the reviewed exact #1220 type-surface model.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	createVo1220ExactModel, vo1220ExactModelPath
} from "../tests/helpers/vo1220-zero-gap.mjs";

const [mode = "--check"] = process.argv.slice(2);
assert.ok(["--check", "--write"].includes(mode)
	&& process.argv.length <= 3
, "Usage: vo1220-exact-model.mjs [--check|--write]");
const [document, irSchema, consumers] = await Promise.all([
	"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
	, "docs/consumer-support.v1.json"
].map(async path => JSON.parse(await readFile(path, "utf8"))));
const bytes = canonicalJson(createVo1220ExactModel(document, {
	irSchema, consumers
}));
if(mode === "--write")
{
	assert.equal(existsSync(vo1220ExactModelPath), false
		, `${vo1220ExactModelPath} already exists; review its diff explicitly`);
	await writeFile(vo1220ExactModelPath, bytes, { flag: "wx" });
}
else
	assert.equal(await readFile(vo1220ExactModelPath, "utf8"), bytes
		, "The reviewed #1220 exact model differs from the current inventory");
process.stdout.write(`${mode.slice(2)} ${vo1220ExactModelPath} `
	+ `${sha256(bytes)} ${Buffer.byteLength(bytes)} bytes\n`);
