/**
 * Preserve Ruby borrow receipts across the closed test-profile registration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedRubyBorrowCiPath = "docs/evidence/owned-ruby-borrow-ci-repair-20260930.json";
export const ownedRubyBorrowCiBaseline = "fbdcc20287f8491dbe6435be003a08733fa717c4";
export const ownedRubyBorrowCiPrevious = Object.freeze({
	path: "docs/evidence/owned-ruby-borrows-20260930.json"
	, sha256: "f35cc128fd44fc349535dd8874ece55793710b8dfd55abea0170f8aaf885247d"
});
export const ownedRubyBorrowCiChangedPaths = [
	"docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
	, "tests/helpers/owned-python-borrow-history.mjs"
	, "tests/helpers/owned-ruby-borrow-history.mjs"
	, "tests/owned-ruby-borrow-evidence.test.mjs"
].sort();
export const ownedRubyBorrowCiAddedPaths = [
	"docs/evidence/owned-ruby-borrow-ci-repair-20260930.md"
	, "tests/helpers/owned-ruby-borrow-ci-history.mjs"
].sort();
let cached;
export const ownedRubyBorrowCiNormalizationPaths = ownedRubyBorrowCiChangedPaths;

/**
 * Reverse authenticated complete-file versions through exact ordered edits.
 *
 * @param source - Current complete source text.
 * @param update - Recorded identities and reversal spans.
 */
export const reverseOwnedRubyBorrowCiUpdate = (source, update) => {
	assert.ok(ownedRubyBorrowCiChangedPaths.includes(update.path), update.path);
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
 * Leave unrecorded edits visible and stop at a requested source identity.
 *
 * @param path - Repository-relative path.
 * @param source - Current complete source text.
 * @param expected - Optional historical stopping digest.
 */
export const beforeOwnedRubyBorrowCi = (path, source, expected) => {
	if(!ownedRubyBorrowCiChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedRubyBorrowCiPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-ruby-borrow-ci-repair");
	assert.equal(record.baselineRevision, ownedRubyBorrowCiBaseline);
	assert.deepEqual(record.previous, ownedRubyBorrowCiPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedRubyBorrowCiChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedRubyBorrowCiUpdate(source, update) : source;
};

/**
 * Only registered text paths participate in source-history reconstruction.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete current source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedRubyBorrowCiHistoricalBytes = (path, bytes, expected) => ownedRubyBorrowCiNormalizationPaths.includes(path)
	? beforeOwnedRubyBorrowCi(path, bytes.toString("utf8"), expected) : bytes;
