/**
 * Authenticate Ruby whole-owner changes without rewriting earlier receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedRubyBorrowCi, ownedRubyBorrowCiNormalizationPaths } from "./owned-ruby-borrow-ci-history.mjs";

export const ownedRubyBorrowPath = "docs/evidence/owned-ruby-borrows-20260930.json";
export const ownedRubyBorrowBaseline = "62cadd853a10cdd366f0fe79044739f64e5c17da";
export const ownedRubyBorrowPrevious = Object.freeze({
	path: "docs/evidence/owned-python-borrows-20260930.json"
	, sha256: "128e690bc5193cbe6404714928b017815ef14c0d229779411aad07c91c9988ac"
});
export const ownedRubyBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/consume/ruby.md"
	, "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/rubygems.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/ruby/owned-call-boundary.mjs"
	, "src/backends/ruby/owned-callables.mjs"
	, "src/backends/ruby/owned-conversion-runtime.mjs"
	, "src/backends/ruby/owned-conversions.mjs"
	, "src/backends/ruby/owned-package.mjs"
	, "src/backends/ruby/owned-runtime.mjs"
	, "src/backends/ruby/owned-values.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-ruby-artifacts.mjs"
	, "src/build/owned-ruby-projection.mjs"
	, "src/release/owned-rubygems.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-python-borrow-history.mjs"
	, "tests/helpers/owned-rust-borrow-history.mjs"
	, "tests/owned-python-borrow-evidence.test.mjs"
].sort();
export const ownedRubyBorrowAddedPaths = [
	"docs/evidence/owned-ruby-borrows-20260930.md"
	, "src/backends/ruby/owned-borrows.mjs"
	, "tests/fixtures/documentation/consumers/ruby/owned-borrows.rb"
	, "tests/fixtures/structured-types/owned-installed-ruby-borrows.rb"
	, "tests/fixtures/structured-types/owned-ruby-borrows.rb"
	, "tests/helpers/owned-ruby-borrow-evidence.mjs"
	, "tests/helpers/owned-ruby-borrow-history.mjs"
	, "tests/owned-ruby-borrow-evidence.test.mjs"
	, "tests/owned-ruby-borrow-packaging.test.mjs"
	, "tests/owned-ruby-borrows.test.mjs"
].sort();
let cached;
export const ownedRubyBorrowNormalizationPaths = [...new Set([...ownedRubyBorrowChangedPaths, ...ownedRubyBorrowCiNormalizationPaths])].sort();

/**
 * Restore an authenticated complete source through exact ordered edits.
 *
 * @param source - Complete current source text.
 * @param update - Both source hashes and exact reversal spans.
 */
export const reverseOwnedRubyBorrowUpdate = (source, update) => {
	assert.ok(ownedRubyBorrowChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0; const parts = [];
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current, update.path);
		parts.push(source.slice(end, start), previous); end = start + current.length;
	}
	parts.push(source.slice(end)); const restored = parts.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path); return restored;
};

/**
 * Rewind only recorded complete versions, stopping at a requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeOwnedRubyBorrow = (path, source, expected) => {
	source = beforeOwnedRubyBorrowCi(path, source, expected);
	if(!ownedRubyBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedRubyBorrowPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-ruby-borrows");
	assert.equal(record.baselineRevision, ownedRubyBorrowBaseline);
	assert.deepEqual(record.previous, ownedRubyBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedRubyBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedRubyBorrowUpdate(source, update) : source;
};

/**
 * Decode registered source text only; preserve unrelated bytes.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedRubyBorrowHistoricalBytes = (path, bytes, expected) => ownedRubyBorrowNormalizationPaths.includes(path)
	? beforeOwnedRubyBorrow(path, bytes.toString("utf8"), expected) : bytes;
