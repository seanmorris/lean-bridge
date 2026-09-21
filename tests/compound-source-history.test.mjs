/**
 * Import-only receipt reconciliation must reject all unrelated source edits.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertCompoundSourceHash } from "./helpers/compound-source-history.mjs";

test("historical compound hashes admit only the exact alias-fixture import upgrade", () => {
	const path = "tests/perl-compounds.test.mjs";
	const previous = 'import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";\nassert.equal(checks, 42);\n';
	const current = previous.replace("compound-fixture.mjs", "compound-source-fixture.mjs");
	const hash = sha256(previous);
	assertCompoundSourceHash(path, Buffer.from(previous), hash);
	assertCompoundSourceHash(path, Buffer.from(current), hash);
	for(const contents of [current.replace("42", "41"), current + "\n", current + current, previous + current, ""])
		assert.throws(() => assertCompoundSourceHash(path, Buffer.from(contents), hash));
	assert.throws(() => assertCompoundSourceHash("tests/fixtures/compound-consumers/perl.pl", Buffer.from(current), hash));
	assert.throws(() => assertCompoundSourceHash(path, Buffer.from(current), "0".repeat(64)));
});
