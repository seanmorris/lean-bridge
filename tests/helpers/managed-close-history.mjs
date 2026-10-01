/**
 * Authenticate Python/Ruby close repairs without rewriting predecessor receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedPerlBorrow, ownedPerlBorrowChangedPaths } from "./owned-perl-borrow-history.mjs";

export const managedClosePath = "docs/evidence/managed-whole-close-repair-20260930.json";
export const managedCloseBaseline = "86a41767fe33e3c12e4e8524d16d99f596c7f05f";
export const managedClosePrevious = Object.freeze({
	path: "docs/evidence/structured-docs-ci-repair-20260930.json"
	, sha256: "968fc30a5049660c100e9b13ff43bd535bf50e01fbbcd838dd609016187d938a"
});
export const managedCloseChangedPaths = [
	"docs/consume/python.md", "docs/consume/ruby.md"
	, "docs/contributing/testing.md", "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/python/owned-borrows.mjs"
	, "src/backends/ruby/owned-borrows.mjs"
	, "tests/fixtures/structured-types/owned-python-borrows.py"
	, "tests/fixtures/structured-types/owned-ruby-borrows.rb"
	, "tests/helpers/owned-dotnet-lifetime-history.mjs"
	, "tests/helpers/owned-python-borrow-evidence.mjs"
	, "tests/helpers/owned-ruby-borrow-evidence.mjs"
	, "tests/helpers/structured-docs-ci-history.mjs"
	, "tests/owned-python-borrows.test.mjs"
	, "tests/owned-ruby-borrows.test.mjs"
	, "tests/structured-docs-ci-evidence.test.mjs"
].sort();
export const managedCloseAddedPaths = [
	"docs/evidence/managed-whole-close-repair-20260930.md"
	, "tests/helpers/managed-close-evidence.mjs"
	, "tests/helpers/managed-close-generated-history.mjs"
	, "tests/helpers/managed-close-history.mjs"
	, "tests/managed-close-evidence.test.mjs"
	, "tests/managed-close-generated-history.test.mjs"
].sort();
let cached;
export const managedCloseNormalizationPaths = [...new Set([...managedCloseChangedPaths, ...ownedPerlBorrowChangedPaths])].sort();

/**
 * Reverse authenticated complete-file versions through exact ordered edits.
 *
 * @param source - Current complete source.
 * @param update - Recorded hashes and exact replacement spans.
 */
export const reverseManagedCloseUpdate = (source, update) => {
	assert.ok(managedCloseChangedPaths.includes(update.path), update.path);
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
 * Stop at a requested digest and preserve every unrecorded source change.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeManagedClose = (path, source, expected) => {
	source = beforeOwnedPerlBorrow(path, source, expected);
	if(!managedCloseChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(managedClosePath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "managed-whole-close-repair");
	assert.equal(record.baselineRevision, managedCloseBaseline);
	assert.deepEqual(record.previous, managedClosePrevious);
	assert.deepEqual(record.updates.map(update => update.path), managedCloseChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseManagedCloseUpdate(source, update) : source;
};

/**
 * Decode only registered text paths and leave unrelated bytes unchanged.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current bytes.
 * @param expected - Optional stopping digest.
 */
export const managedCloseHistoricalBytes = (path, bytes, expected) => managedCloseNormalizationPaths.includes(path)
	? beforeManagedClose(path, bytes.toString("utf8"), expected) : bytes;
