/**
 * Authenticate source transitions for whole-value Rust borrowed results.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedPythonBorrow, ownedPythonBorrowNormalizationPaths } from "./owned-python-borrow-history.mjs";

export const ownedRustBorrowPath = "docs/evidence/owned-rust-borrows-20260930.json";
export const ownedRustBorrowBaseline = "741a2af5e68a77996f2b478b4110d97bfc6e4c58";
export const ownedRustBorrowPrevious = Object.freeze({
	path: "docs/evidence/owned-cpp-borrow-ci-repair-20260930.json"
	, sha256: "e1f42c8b89d1b875ee94660dc1631ff936479206c4a1238b0f4367b12f532fa3"
});
export const ownedRustBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/architecture/binding-ir.md"
	, "docs/consume/rust.md", "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md", "docs/publish/cargo.md"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, ...["callables", "conversions", "package", "runtime", "values"].map(name => `src/backends/rust/owned-${name}.mjs`)
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "src/build/owned-c-projection.mjs", "src/build/owned-rust-artifacts.mjs"
	, "src/build/owned-rust-projection.mjs", "src/release/owned-cargo.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-cpp-borrow-ci-evidence.mjs"
	, "tests/helpers/owned-cpp-borrow-ci-history.mjs"
	, "tests/helpers/owned-cpp-borrow-history.mjs"
	, "tests/owned-cpp-borrow-evidence.test.mjs"
].sort();
export const ownedRustBorrowAddedPaths = [
	"docs/evidence/owned-rust-borrows-20260930.md"
	, "src/backends/rust/owned-borrows.mjs"
	, "tests/fixtures/documentation/consumers/rust/owned-borrows.rs"
	, "tests/fixtures/structured-types/owned-rust-borrows.rs"
	, "tests/helpers/owned-rust-borrow-evidence.mjs"
	, "tests/helpers/owned-rust-borrow-fixture.mjs"
	, "tests/helpers/owned-rust-borrow-history.mjs"
	, "tests/owned-rust-borrow-evidence.test.mjs"
	, "tests/owned-rust-borrow-packaging.test.mjs"
	, "tests/owned-rust-borrows.test.mjs"
].sort();
let cached;
export const ownedRustBorrowNormalizationPaths = [...new Set([...ownedRustBorrowChangedPaths, ...ownedPythonBorrowNormalizationPaths])].sort();

/**
 * Reverse complete authenticated source versions through exact ordered edits.
 *
 * @param source - Complete current source.
 * @param update - Current and previous hashes plus reversal spans.
 */
export const reverseOwnedRustBorrowUpdate = (source, update) => {
	assert.ok(ownedRustBorrowChangedPaths.includes(update.path), update.path);
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
 * Leave unknown edits visible and stop at the requested historical identity.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeOwnedRustBorrow = (path, source, expected) => {
	source = beforeOwnedPythonBorrow(path, source, expected);
	if(!ownedRustBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedRustBorrowPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-rust-borrows");
	assert.equal(record.baselineRevision, ownedRustBorrowBaseline);
	assert.deepEqual(record.previous, ownedRustBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedRustBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedRustBorrowUpdate(source, update) : source;
};

/**
 * Decode registered source text only; leave unrelated binary bytes intact.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete current source bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedRustBorrowHistoricalBytes = (path, bytes, expected) => ownedRustBorrowNormalizationPaths.includes(path)
	? beforeOwnedRustBorrow(path, bytes.toString("utf8"), expected) : bytes;
