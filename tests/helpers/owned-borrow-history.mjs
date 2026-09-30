/**
 * Preserve immutable receipts across original-owner result support in C.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedBorrowBaseline = "2fab6b1635341d6622fc13fe8da9b3fdc947790e";
export const ownedBorrowPath = "docs/evidence/owned-borrow-results-20260930.json";
export const ownedBorrowPrevious = Object.freeze({
	path: "docs/evidence/wit-owned-transfers-20260930.json"
	, sha256: "357ab696d0490258c32ea524d8cb0a5d900aff3ed63c447275f85e1d495aa789"
});
export const ownedBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml", "docs/architecture/binding-ir.md"
	, "docs/consume/c.md", "docs/contributing/testing.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/publish/c.md", "docs/type-surface.v1.json", "package.json"
	, "src/adoption/test-profiles.mjs", "src/analyze/NativeExports.lean"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/reviewed-owned-source.mjs"
	, "src/analyze/semantic-model.mjs"
	, ...["callbacks", "package", "runtime", "transfers", "values"].map(name => `src/backends/c/owned-${name}.mjs`)
	, "src/backends/native/owned-aggregate-leases.mjs"
	, "src/backends/native/owned-aggregate-transfers.mjs"
	, ...["adapters", "layout", "runtime"].map(name => `src/backends/native/owned-value-${name}.mjs`)
	, "src/build/native-artifacts.mjs", "src/build/native-c-projection.mjs"
	, "src/build/native-component.mjs", "src/build/native-graph-model.mjs"
	, "src/build/native-project.mjs", "src/build/owned-c-projection.mjs"
	, "src/build/owned-native-model.mjs", "src/release/owned-c-package.mjs"
	, "tests/helpers/owned-javascript-transfer-history.mjs"
	, "tests/helpers/wit-owned-transfer-history.mjs"
	, "tests/wit-owned-transfer-evidence.test.mjs"
	, "tests/documentation.test.mjs"
].sort();
export const ownedBorrowAddedPaths = [
	"docs/evidence/owned-borrow-runtime-20260930.md"
	, "tests/fixtures/structured-types/owned-aggregate-borrows.c"
	, "tests/fixtures/structured-types/owned-public-borrows.c"
	, "tests/helpers/owned-borrow-evidence.mjs"
	, "tests/helpers/owned-borrow-fixture.mjs"
	, "tests/helpers/owned-borrow-history.mjs"
	, "tests/owned-aggregate-borrows.test.mjs"
	, "tests/owned-borrow-analysis.test.mjs"
	, "tests/owned-borrow-evidence.test.mjs"
	, "tests/owned-borrow-packaging.test.mjs"
	, "tests/owned-c-borrows.test.mjs"
].sort();
let cached;

/**
 * Reverse only recorded non-overlapping edits with matching whole-file hashes.
 *
 * @param source - Complete current source text.
 * @param update - Exact current/previous hashes and replacement spans.
 */
export const reverseOwnedBorrowUpdate = (source, update) => {
	assert.ok(ownedBorrowChangedPaths.includes(update.path), update.path);
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
 * Leave unrecorded edits visible to every older receipt verifier.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional historical stopping digest.
 */
export const beforeOwnedBorrow = (path, source, expected) => {
	if(!ownedBorrowChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedBorrowPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-borrow-results");
	assert.equal(record.baselineRevision, ownedBorrowBaseline);
	assert.deepEqual(record.previous, ownedBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedBorrowUpdate(source, update) : source;
};

/**
 * Decode only this milestone's declared text files.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedBorrowHistoricalBytes = (path, bytes, expected) => ownedBorrowChangedPaths.includes(path)
	? beforeOwnedBorrow(path, bytes.toString("utf8"), expected) : bytes;
