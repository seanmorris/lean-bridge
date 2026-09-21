/**
 * Retain historical hashes through reviewed, exact alias fixture upgrades.
 * Reconstruct the original bytes without changing recorded archive identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

const upgraded = new Set(["perl", "php", "php-wasm", "ruby", "wit"].map(name => `tests/${name}-compounds.test.mjs`));
const previous = 'from "./helpers/compound-fixture.mjs";';
const current = 'from "./helpers/compound-source-fixture.mjs";';
const pythonPrevious = '    if name not in ("Option", "Result"):\n';
const pythonCurrent = `    if name == "Deep":
        expected = api.Result[tuple[int, None], str]
        for _ in range(24):
            expected = api.Option[expected]
        check(value == expected)
        check(typing.get_type_hints(api.deep)["return"] == expected)
    elif name not in ("Option", "Result"):
`;

/**
 * Authenticate unchanged source or an exact reviewed alias inspection/import change.
 *
 * @param path - Source path recorded in the historical receipt.
 * @param contents - Current source bytes.
 * @param expected - Unchanged historical SHA-256.
 */
export const assertCompoundSourceHash = (path, contents, expected) => {
	if(sha256(contents) === expected) return;
	const source = contents.toString();
	if(path === "tests/fixtures/compound-consumers/python.py")
	{
		assert.equal(source.split(pythonCurrent).length, 2, "Expected exactly one checked Python alias inspection");
		assert.ok(!source.includes(pythonPrevious), "Mixed historical and current Python alias inspections");
		assert.equal(sha256(source.replace(pythonCurrent, pythonPrevious)), expected, path);
		return;
	}
	assert.ok(upgraded.has(path), `Unreviewed historical source change: ${path}`);
	assert.equal(source.split(current).length, 2, `Expected exactly one alias-fixture import: ${path}`);
	assert.ok(!source.includes(previous), `Mixed historical and current fixture imports: ${path}`);
	assert.equal(sha256(source.replace(current, previous)), expected, path);
};
