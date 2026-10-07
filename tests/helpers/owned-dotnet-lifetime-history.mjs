/**
 * Authenticate C# lifetime repairs without rewriting previous source receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeStructuredDocsCi, structuredDocsCiNormalizationPaths } from "./structured-docs-ci-history.mjs";

export const ownedDotnetLifetimePath = "docs/evidence/owned-dotnet-lifetime-repair-20260930.json";
export const ownedDotnetLifetimeBaseline = "f5cde9256639f3989464822f8cf711015d518b31";
export const ownedDotnetLifetimePrevious = Object.freeze({
	path: "docs/evidence/owned-jvm-borrows-20260930.json"
	, sha256: "55f14a0edad1eadb0deb1b7a8d20bfe28cffbe0dd1227321582bc2908834cb5e"
});
export const ownedDotnetLifetimeChangedPaths = [
	"docs/consume/dotnet.md", "docs/contributing/testing.md"
	, "docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
	, "src/backends/dotnet/owned-borrows.mjs"
	, "tests/fixtures/structured-types/owned-dotnet-borrows.cs"
	, "tests/helpers/owned-dotnet-borrow-evidence.mjs"
	, "tests/helpers/owned-jvm-borrow-history.mjs"
	, "tests/owned-dotnet-borrows.test.mjs"
	, "tests/owned-jvm-borrow-evidence.test.mjs"
].sort();
export const ownedDotnetLifetimeAddedPaths = [
	"docs/evidence/owned-dotnet-lifetime-repair-20260930.md"
	, "tests/helpers/owned-dotnet-lifetime-history.mjs"
	, "tests/helpers/owned-dotnet-read-race-generated.mjs"
	, "tests/owned-dotnet-lifetime-evidence.test.mjs"
].sort();
let cached;
export const ownedDotnetLifetimeNormalizationPaths = [...new Set([...ownedDotnetLifetimeChangedPaths, ...structuredDocsCiNormalizationPaths])].sort();

/**
 * Reverse only recorded spans whose complete before/after identities match.
 *
 * @param source - Complete current source text.
 * @param update - Exact ordered replacements and both hashes.
 */
export const reverseOwnedDotnetLifetimeUpdate = (source, update) => {
	assert.ok(ownedDotnetLifetimeChangedPaths.includes(update.path), update.path);
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
 * Stop at an expected identity; leave every unrecorded source change visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional stopping digest.
 */
export const beforeOwnedDotnetLifetime = (path, source, expected) => {
	source = beforeStructuredDocsCi(path, source, expected);
	if(!ownedDotnetLifetimeChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedDotnetLifetimePath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-dotnet-lifetime-repair");
	assert.equal(record.baselineRevision, ownedDotnetLifetimeBaseline);
	assert.deepEqual(record.previous, ownedDotnetLifetimePrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedDotnetLifetimeChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedDotnetLifetimeUpdate(source, update) : source;
};

/**
 * Decode registered source text only, preserving unrelated bytes.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedDotnetLifetimeHistoricalBytes = (path, bytes, expected) => ownedDotnetLifetimeNormalizationPaths.includes(path)
	? beforeOwnedDotnetLifetime(path, bytes.toString("utf8"), expected) : bytes;
