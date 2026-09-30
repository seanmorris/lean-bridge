/**
 * Authenticate JVM whole-owner changes without rewriting earlier receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedDotnetLifetime, ownedDotnetLifetimeChangedPaths } from "./owned-dotnet-lifetime-history.mjs";

export const ownedJvmBorrowPath = "docs/evidence/owned-jvm-borrows-20260930.json";
export const ownedJvmBorrowBaseline = "444cace8fed766606caf7bb70e68a9a0badf3ec1";
export const ownedJvmBorrowPrevious = Object.freeze({
	path: "docs/evidence/owned-dotnet-borrows-20260930.json"
	, sha256: "6ea35c6fb18d4d1b0d204186a28635b7a10aa9fd7e2c79a767b0f80dd6295bfe"
});
export const ownedJvmBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md", "docs/consume/java.md"
	, "docs/consume/kotlin.md", "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md", "docs/publish/maven.md"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, "src/backends/jvm/owned-callables.mjs", "src/backends/jvm/owned-calls.mjs"
	, "src/backends/jvm/owned-conversion-runtime.mjs"
	, "src/backends/jvm/owned-conversions.mjs"
	, "src/backends/jvm/owned-kotlin.mjs", "src/backends/jvm/owned-layout.mjs"
	, "src/backends/jvm/owned-package.mjs", "src/backends/jvm/owned-runtime.mjs"
	, "src/backends/jvm/owned-values.mjs", "src/build/compile-jvm-sources.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "src/build/owned-jvm-artifacts.mjs", "src/build/owned-jvm-projection.mjs"
	, "src/release/owned-maven.mjs", "tests/documentation.test.mjs"
	, "tests/helpers/owned-dotnet-borrow-history.mjs"
	, "tests/helpers/owned-jvm-call-fixture.mjs"
	, "tests/helpers/owned-jvm-installed-assets.mjs"
	, "tests/helpers/owned-jvm-installed-signatures.mjs"
	, "tests/helpers/owned-jvm-package-tamper.mjs"
	, "tests/owned-dotnet-borrow-evidence.test.mjs"
].sort();
export const ownedJvmBorrowAddedPaths = [
	"docs/evidence/owned-jvm-borrows-20260930.md"
	, "src/backends/jvm/owned-borrows.mjs"
	, "tests/fixtures/documentation/consumers/java/OwnedBorrowExample.java"
	, "tests/fixtures/documentation/consumers/kotlin/OwnedBorrowExample.kt"
	, "tests/fixtures/structured-types/owned-jvm-borrows.java"
	, "tests/fixtures/structured-types/owned-kotlin-borrows.kt"
	, "tests/helpers/owned-jvm-borrow-evidence.mjs"
	, "tests/helpers/owned-jvm-borrow-history.mjs"
	, "tests/helpers/owned-jvm-borrow-installed.mjs"
	, "tests/owned-jvm-borrow-evidence.test.mjs"
	, "tests/owned-jvm-borrow-packaging.test.mjs"
	, "tests/owned-jvm-borrows.test.mjs"
].sort();
let cached;
export const ownedJvmBorrowNormalizationPaths = [...new Set([...ownedJvmBorrowChangedPaths, ...ownedDotnetLifetimeChangedPaths])];

/**
 * Restore an authenticated complete source through exact ordered edits.
 *
 * @param source - Complete current source text.
 * @param update - Both source hashes and exact reversal spans.
 */
export const reverseOwnedJvmBorrowUpdate = (source, update) => {
	assert.ok(ownedJvmBorrowChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedJvmBorrow = (path, source, expected) => {
	source = beforeOwnedDotnetLifetime(path, source, expected);
	if(!ownedJvmBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedJvmBorrowPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-jvm-borrows");
	assert.equal(record.baselineRevision, ownedJvmBorrowBaseline);
	assert.deepEqual(record.previous, ownedJvmBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedJvmBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedJvmBorrowUpdate(source, update) : source;
};

/**
 * Decode registered source text only; preserve unrelated bytes.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedJvmBorrowHistoricalBytes = (path, bytes, expected) => ownedJvmBorrowNormalizationPaths.includes(path)
	? beforeOwnedJvmBorrow(path, bytes.toString("utf8"), expected) : bytes;
