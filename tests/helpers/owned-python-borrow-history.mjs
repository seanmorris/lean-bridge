/**
 * Authenticate Python whole-owner changes without rewriting earlier receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedRubyBorrow, ownedRubyBorrowChangedPaths } from "./owned-ruby-borrow-history.mjs";

export const ownedPythonBorrowPath = "docs/evidence/owned-python-borrows-20260930.json";
export const ownedPythonBorrowBaseline = "e14a880886634053116c9546ced265a345281b2a";
export const ownedPythonBorrowPrevious = Object.freeze({
	path: "docs/evidence/owned-rust-borrows-20260930.json"
	, sha256: "e613f03de21625e89dca5cdbfe89572c33c8e504aa2bfee8ae12b355bcaf86ea"
});
export const ownedPythonBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/architecture/binding-ir.md"
	, "docs/consume/python.md", "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md", "docs/publish/pypi.md"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, ...["callables", "conversions", "package", "runtime", "values"].map(name => `src/backends/python/owned-${name}.mjs`)
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "src/build/owned-c-projection.mjs", "src/build/owned-python-artifacts.mjs"
	, "src/build/owned-rust-artifacts.mjs", "src/release/owned-pypi.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-cpp-borrow-ci-history.mjs"
	, "tests/helpers/owned-rust-borrow-history.mjs"
	, "tests/owned-rust-borrow-evidence.test.mjs"
].sort();
export const ownedPythonBorrowAddedPaths = [
	"docs/evidence/owned-python-borrows-20260930.md"
	, "src/backends/python/owned-borrows.mjs"
	, "tests/fixtures/documentation/consumers/python/owned-borrows.py"
	, "tests/fixtures/structured-types/owned-installed-python-borrows.py"
	, "tests/fixtures/structured-types/owned-python-borrows.py"
	, "tests/helpers/owned-python-borrow-evidence.mjs"
	, "tests/helpers/owned-python-borrow-history.mjs"
	, "tests/owned-python-borrow-evidence.test.mjs"
	, "tests/owned-python-borrow-packaging.test.mjs"
	, "tests/owned-python-borrows.test.mjs"
].sort();
let cached;
export const ownedPythonBorrowNormalizationPaths = [...new Set([...ownedPythonBorrowChangedPaths, ...ownedRubyBorrowChangedPaths])].sort();

/**
 * Restore an authenticated complete source through exact ordered edits.
 *
 * @param source - Complete current source text.
 * @param update - Both source hashes and exact reversal spans.
 */
export const reverseOwnedPythonBorrowUpdate = (source, update) => {
	assert.ok(ownedPythonBorrowChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPythonBorrow = (path, source, expected) => {
	source = beforeOwnedRubyBorrow(path, source, expected);
	if(!ownedPythonBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPythonBorrowPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-python-borrows");
	assert.equal(record.baselineRevision, ownedPythonBorrowBaseline);
	assert.deepEqual(record.previous, ownedPythonBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedPythonBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedPythonBorrowUpdate(source, update) : source;
};

/**
 * Decode registered source text only; preserve unrelated bytes.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedPythonBorrowHistoricalBytes = (path, bytes, expected) => ownedPythonBorrowNormalizationPaths.includes(path)
	? beforeOwnedPythonBorrow(path, bytes.toString("utf8"), expected) : bytes;
