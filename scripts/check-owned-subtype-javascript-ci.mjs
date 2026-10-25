#!/usr/bin/env node
/**
 * Require complete retained owned-Subtype npm and browser acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { verifyOwnedSubtypeJavaScriptEvidence } from "../tests/helpers/owned-subtype-javascript-evidence.mjs";

const args = process.argv.slice(2);
const usage = "Usage: check-owned-subtype-javascript-ci.mjs --report <path>";
assert.deepEqual(args.slice(0, 1), ["--report"], usage);
assert.equal(args.length, 2, usage);
process.stdout.write(canonicalJson(
	await verifyOwnedSubtypeJavaScriptEvidence(resolve(args[1]))
));
