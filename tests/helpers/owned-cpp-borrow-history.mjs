/**
 * Preserve immutable receipts across whole-value C++ borrowed-result support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedCppBorrowBaseline = "2e422bde5449fd6578af0d4c27256e7110ec3c48";
export const ownedCppBorrowPath = "docs/evidence/owned-cpp-borrows-20260930.json";
export const ownedCppBorrowPrevious = Object.freeze({
	path: "docs/evidence/owned-borrow-ci-repair-20260930.json"
	, sha256: "407e986e130bf85c6256cb7e34c573dd2560f038d798862aefd2d3e52b7727bf"
});
export const ownedCppBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml", "docs/architecture/binding-ir.md"
	, "docs/consume/cpp.md", "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md", "docs/publish/cpp.md"
	, "docs/type-surface.v1.json", "package.json", "src/adoption/test-profiles.mjs"
	, ...["callables", "conversions", "package", "runtime", "values"].map(name => `src/backends/cpp/owned-${name}.mjs`)
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "src/build/owned-c-projection.mjs", "src/release/owned-c-package.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-borrow-ci-evidence.mjs"
	, "tests/helpers/owned-borrow-ci-history.mjs"
	, "tests/helpers/owned-borrow-history.mjs"
	, "tests/owned-borrow-evidence.test.mjs"
	, "tests/owned-borrow-packaging.test.mjs"
].sort();
export const ownedCppBorrowAddedPaths = [
	"docs/evidence/owned-cpp-borrows-20260930.md"
	, "src/backends/cpp/owned-borrows.mjs"
	, "tests/fixtures/documentation/consumers/cpp/owned-borrows.cpp"
	, "tests/fixtures/structured-types/owned-cpp-borrows.cpp"
	, "tests/helpers/owned-cpp-borrow-evidence.mjs"
	, "tests/helpers/owned-cpp-borrow-fixture.mjs"
	, "tests/helpers/owned-cpp-borrow-history.mjs"
	, "tests/owned-cpp-borrow-evidence.test.mjs"
	, "tests/owned-cpp-borrow-packaging.test.mjs"
	, "tests/owned-cpp-borrows.test.mjs"
].sort();
let cached;

/**
 * Reverse only recorded, ordered edits with matching complete source identities.
 *
 * @param source - Complete source text.
 * @param update - Current/previous digests and exact reversible edit spans.
 */
export const reverseOwnedCppBorrowUpdate = (source, update) => {
	assert.ok(ownedCppBorrowChangedPaths.includes(update.path), update.path);
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
 * Preserve unrecorded changes and stop at explicitly requested historical bytes.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional historical stopping digest.
 */
export const beforeOwnedCppBorrow = (path, source, expected) => {
	if(!ownedCppBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedCppBorrowPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-cpp-borrows");
	assert.equal(record.baselineRevision, ownedCppBorrowBaseline);
	assert.deepEqual(record.previous, ownedCppBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedCppBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedCppBorrowUpdate(source, update) : source;
};

/**
 * Decode only this milestone's text paths; leave unrelated binary bytes intact.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedCppBorrowHistoricalBytes = (path, bytes, expected) => ownedCppBorrowChangedPaths.includes(path)
	? beforeOwnedCppBorrow(path, bytes.toString("utf8"), expected) : bytes;
