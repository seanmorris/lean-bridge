/**
 * Authenticate Dotnet whole-owner changes without rewriting earlier receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedDotnetBorrowPath = "docs/evidence/owned-dotnet-borrows-20260930.json";
export const ownedDotnetBorrowBaseline = "1211baf52e92dd4012d075948ca6bf95bda81282";
export const ownedDotnetBorrowPrevious = Object.freeze({
	path: "docs/evidence/owned-ruby-borrow-ci-repair-20260930.json"
	, sha256: "6316e57ce8526d78b3de29614d28de50a3178f84b82bd5774fd8c362b498c086"
});
export const ownedDotnetBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/consume/dotnet.md"
	, "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/nuget.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/dotnet/owned-calls.mjs"
	, "src/backends/dotnet/owned-conversion-runtime.mjs"
	, "src/backends/dotnet/owned-conversions.mjs"
	, "src/backends/dotnet/owned-layout.mjs"
	, "src/backends/dotnet/owned-package.mjs"
	, "src/backends/dotnet/owned-runtime.mjs"
	, "src/backends/dotnet/owned-values.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-dotnet-artifacts.mjs"
	, "src/build/owned-dotnet-projection.mjs"
	, "src/release/owned-nuget.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-dotnet-native.mjs"
	, "tests/helpers/owned-ruby-borrow-ci-history.mjs"
	, "tests/owned-ruby-borrow-evidence.test.mjs"
].sort();
export const ownedDotnetBorrowAddedPaths = [
	"docs/evidence/owned-dotnet-borrows-20260930.md"
	, "src/backends/dotnet/owned-borrows.mjs"
	, "tests/fixtures/documentation/consumers/dotnet/owned-borrows.cs"
	, "tests/fixtures/structured-types/owned-dotnet-borrows.cs"
	, "tests/fixtures/structured-types/owned-installed-dotnet-borrows.cs"
	, "tests/helpers/owned-dotnet-borrow-evidence.mjs"
	, "tests/helpers/owned-dotnet-borrow-history.mjs"
	, "tests/helpers/owned-dotnet-borrow-installed.mjs"
	, "tests/owned-dotnet-borrow-evidence.test.mjs"
	, "tests/owned-dotnet-borrow-packaging.test.mjs"
	, "tests/owned-dotnet-borrows.test.mjs"
].sort();
let cached;
export const ownedDotnetBorrowNormalizationPaths = ownedDotnetBorrowChangedPaths;

/**
 * Restore an authenticated complete source through exact ordered edits.
 *
 * @param source - Complete current source text.
 * @param update - Both source hashes and exact reversal spans.
 */
export const reverseOwnedDotnetBorrowUpdate = (source, update) => {
	assert.ok(ownedDotnetBorrowChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedDotnetBorrow = (path, source, expected) => {
	if(!ownedDotnetBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedDotnetBorrowPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-dotnet-borrows");
	assert.equal(record.baselineRevision, ownedDotnetBorrowBaseline);
	assert.deepEqual(record.previous, ownedDotnetBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedDotnetBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedDotnetBorrowUpdate(source, update) : source;
};

/**
 * Decode registered source text only; preserve unrelated bytes.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedDotnetBorrowHistoricalBytes = (path, bytes, expected) => ownedDotnetBorrowNormalizationPaths.includes(path)
	? beforeOwnedDotnetBorrow(path, bytes.toString("utf8"), expected) : bytes;
