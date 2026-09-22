/**
 * Authenticate historical verifier bytes through exact copied-input upgrades.
 * Keep recorded gems, source receipts and their hashes unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

const fixtureImport = 'import { rubyVariantReviewedIr, rubyVariantSignatures } from "./helpers/ruby-variant-fixture.mjs";';
const upgrades = new Map([
	["tests/ruby-variant-contract.test.mjs", [[
		'\tassert.match(native, /value\\.instance_of\\?\\(Signal::Data\\)/);'
		, '\tassert.match(native, /exact\\?\\(value, Signal::Data\\)/);\n\tassert.match(native, /STORED_FIELD\\.bind_call\\(value, :@count\\)/);'
	]]]
	, ["tests/ruby-variant-evidence.test.mjs", [
		[fixtureImport, `${fixtureImport}\nimport { assertRubyVariantSourceHash } from "./helpers/ruby-source-history.mjs";`]
		, ['\tfor(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);'
			, '\tfor(const [path, hash] of Object.entries(record.sourceHashes)) assertRubyVariantSourceHash(path, await readFile(path), hash);']
	]]
]);

/**
 * Verify unchanged input or reconstruct exactly the previously recorded verifier.
 *
 * @param path - Historical source path.
 * @param contents - Current source bytes.
 * @param expected - Unchanged recorded SHA-256.
 */
export const assertRubyVariantSourceHash = (path, contents, expected) => {
	if(sha256(contents) === expected) return;
	assert.ok(upgrades.has(path), `Unreviewed historical Ruby source change: ${path}`);
	let source = contents.toString();
	for(const [previous, current] of upgrades.get(path))
	{
		assert.equal(source.split(current).length, 2, `Expected one exact verifier upgrade: ${path}`);
		source = source.replace(current, previous);
	}
	assert.equal(sha256(source), expected, path);
};
