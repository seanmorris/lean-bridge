#!/usr/bin/env node
/**
 * Audit or record the owned checked-record semantic join.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	auditOwnedCheckedRecordSemanticMatrix
} from "../tests/helpers/owned-checked-record-semantic-audit.mjs";

const output = "docs/evidence/owned-checked-record-semantic-audit-20261026.json";
const write = process.argv.slice(2).includes("--write");
assert.deepEqual(process.argv.slice(2).filter(argument => argument !== "--write"), []
	, "Usage: node scripts/check-owned-checked-record-semantics.mjs [--write]");
const bytes = canonicalJson(auditOwnedCheckedRecordSemanticMatrix());
if(write)
{
	await writeFile(output, bytes, { flag: "wx" });
	process.stdout.write(`Recorded ${output}\n`);
}
else
{
	assert.equal(await readFile(output, "utf8"), bytes
		, "Committed semantic audit is stale; regenerate with --write");
	process.stdout.write("Owned checked-record semantic audit passed.\n");
}
