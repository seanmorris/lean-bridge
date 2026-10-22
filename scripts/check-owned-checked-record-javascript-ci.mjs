#!/usr/bin/env node
/**
 * Independently verify retained npm/browser owned checked-record packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { verifyOwnedCheckedRecordJavaScriptEvidence } from "../tests/helpers/owned-checked-record-javascript-evidence.mjs";

const args = process.argv.slice(2);
assert.deepEqual(args.slice(0, 1), ["--report"]
	, "Usage: check-owned-checked-record-javascript-ci.mjs --report <path>");
assert.equal(args.length, 2
	, "Usage: check-owned-checked-record-javascript-ci.mjs --report <path>");
process.stdout.write(canonicalJson(
	await verifyOwnedCheckedRecordJavaScriptEvidence(resolve(args[1]))
));
