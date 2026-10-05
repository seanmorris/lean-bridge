/**
 * Preserve C++ borrow receipts across the CLI and typecheck inventory repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedRustBorrow, ownedRustBorrowNormalizationPaths } from "./owned-rust-borrow-history.mjs";

export const ownedCppBorrowCiPath = "docs/evidence/owned-cpp-borrow-ci-repair-20260930.json";
export const ownedCppBorrowCiBaseline = "dec8d558423d1b1c2ec4b95999ea8779adb60091";
export const ownedCppBorrowCiPrevious = Object.freeze({
	path: "docs/evidence/owned-cpp-borrows-20260930.json"
	, sha256: "11ffd4420610aa9bc235646d160c097956554d589f324c66c654bbe643ec6940"
});
export const ownedCppBorrowCiChangedPaths = [
	"config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/type-surface.v1.json", "package.json"
	, "tests/helpers/owned-borrow-ci-history.mjs"
	, "tests/helpers/owned-cpp-borrow-history.mjs"
	, "tests/owned-cpp-borrow-evidence.test.mjs"
].sort();
export const ownedCppBorrowCiAddedPaths = [
	"docs/evidence/owned-cpp-borrow-ci-repair-20260930.md"
	, "tests/helpers/owned-cpp-borrow-ci-evidence.mjs"
	, "tests/helpers/owned-cpp-borrow-ci-history.mjs"
].sort();
let cached;
export const ownedCppBorrowCiNormalizationPaths = [...new Set([...ownedCppBorrowCiChangedPaths, ...ownedRustBorrowNormalizationPaths])].sort();

/**
 * Reverse authenticated complete-file versions through exact ordered edits.
 *
 * @param source - Current complete source text.
 * @param update - Recorded identities and reversal spans.
 */
export const reverseOwnedCppBorrowCiUpdate = (source, update) => {
	assert.ok(ownedCppBorrowCiChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedCppBorrowCi = (path, source, expected) => {
	source = beforeOwnedRustBorrow(path, source, expected);
	if(!ownedCppBorrowCiChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedCppBorrowCiPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-cpp-borrow-ci-repair");
	assert.equal(record.baselineRevision, ownedCppBorrowCiBaseline);
	assert.deepEqual(record.previous, ownedCppBorrowCiPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedCppBorrowCiChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedCppBorrowCiUpdate(source, update) : source;
};

/**
 * Only registered text paths participate in source-history reconstruction.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete current source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedCppBorrowCiHistoricalBytes = (path, bytes, expected) => ownedCppBorrowCiNormalizationPaths.includes(path)
	? beforeOwnedCppBorrowCi(path, bytes.toString("utf8"), expected) : bytes;
