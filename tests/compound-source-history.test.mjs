/**
 * Historical receipt reconciliation must reject all unrelated source edits.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("the historical Python consumer admits only the exact Deep alias inspection", async () => {
	const path = "tests/fixtures/compound-consumers/python.py";
	const source = await readFile(path, "utf8");
	const hash = "ee29c436041a087a7420134b02c7a4d747dccfdd867615a66c2571d5a55875c0";
	assertCompoundSourceHash(path, Buffer.from(source), hash);
	for(const change of [source.replace("range(24)", "range(23)"), source.replace("check(value == expected)", "check(True)"), source + "\n", source + source, ""])
		assert.throws(() => assertCompoundSourceHash(path, Buffer.from(change), hash));
	assert.throws(() => assertCompoundSourceHash("tests/fixtures/compound-consumers/perl.pl", Buffer.from(source), hash));
	assert.throws(() => assertCompoundSourceHash(path, Buffer.from(source), "0".repeat(64)));
});
