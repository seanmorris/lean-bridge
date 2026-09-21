/**
 * Retain historical harness hashes through the explicit alias-fixture import upgrade.
 * Consumer code, expected signatures and recorded archive identities do not change.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

const upgraded = new Set(["perl", "php", "php-wasm", "ruby", "wit"].map(name => `tests/${name}-compounds.test.mjs`));
const previous = 'from "./helpers/compound-fixture.mjs";';
const current = 'from "./helpers/compound-source-fixture.mjs";';

/**
 * Authenticate unchanged source, or the single reviewed harness import change.
 *
 * @param path - Source path recorded in the historical receipt.
 * @param contents - Current source bytes.
 * @param expected - Unchanged historical SHA-256.
 */
export const assertCompoundSourceHash = (path, contents, expected) => {
	if(sha256(contents) === expected) return;
	assert.ok(upgraded.has(path), `Unreviewed historical source change: ${path}`);
	const source = contents.toString();
	assert.equal(source.split(current).length, 2, `Expected exactly one alias-fixture import: ${path}`);
	assert.ok(!source.includes(previous), `Mixed historical and current fixture imports: ${path}`);
	assert.equal(sha256(source.replace(current, previous)), expected, path);
};
