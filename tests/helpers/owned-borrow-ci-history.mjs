/**
 * Authenticate the extractor-history repair without rewriting frozen receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedCppBorrow, ownedCppBorrowChangedPaths } from "./owned-cpp-borrow-history.mjs";

export const ownedBorrowCiPath = "docs/evidence/owned-borrow-ci-repair-20260930.json";
export const ownedBorrowCiBaseline = "dffda6f46065692b8ce52bdb05e79b2d7ab8343b";
export const ownedBorrowCiPrevious = Object.freeze({
	path: "docs/evidence/owned-borrow-results-20260930.json"
	, sha256: "908a38b8053da98bb6f77afc7aeae783708e69a0616da8e4c2da3651d0031d88"
});
export const ownedBorrowCiChangedPaths = [
	"tests/helpers/owned-borrow-history.mjs"
	, ...["dotnet", "jvm", "perl", "php", "python", "ruby", "rust"].map(name => `tests/helpers/owned-${name}-transfer-evidence.mjs`)
	, "tests/helpers/wit-owned-transfer-history.mjs"
	, "tests/owned-borrow-evidence.test.mjs"
].sort();
export const ownedBorrowCiAddedPaths = [
	"docs/evidence/owned-borrow-ci-repair-20260930.md"
	, "tests/helpers/owned-borrow-ci-evidence.mjs"
	, "tests/helpers/owned-borrow-ci-history.mjs"
].sort();
let cached;
export const ownedBorrowCiNormalizationPaths = [...new Set([...ownedBorrowCiChangedPaths, ...ownedCppBorrowChangedPaths])].sort();

/**
 * Reverse only complete, authenticated source versions and ordered edit spans.
 *
 * @param source - Complete source text.
 * @param update - Recorded reversible edit with both source identities.
 */
export const reverseOwnedBorrowCiUpdate = (source, update) => {
	assert.ok(ownedBorrowCiChangedPaths.includes(update.path), update.path);
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
 * Stop at a requested identity and leave unrelated edits visible to verifiers.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional historical stopping digest.
 */
export const beforeOwnedBorrowCi = (path, source, expected) => {
	source = beforeOwnedCppBorrow(path, source, expected);
	if(!ownedBorrowCiChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedBorrowCiPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-borrow-ci-repair");
	assert.equal(record.baselineRevision, ownedBorrowCiBaseline);
	assert.deepEqual(record.previous, ownedBorrowCiPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedBorrowCiChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedBorrowCiUpdate(source, update) : source;
};

/**
 * Decode registered text files only; unrelated binary bytes remain unchanged.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedBorrowCiHistoricalBytes = (path, bytes, expected) => ownedBorrowCiNormalizationPaths.includes(path)
	? beforeOwnedBorrowCi(path, bytes.toString("utf8"), expected) : bytes;
