/**
 * Preserve frozen CI receipts across dependency and source-history repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedPhpTransfer, ownedPhpTransferChangedPaths } from "./owned-php-transfer-history.mjs";

export const ownedCiFollowupBaseline = "7ef53b13a552c28d9ccc52b54d197d916836a26c";
export const ownedCiFollowupPath = "docs/evidence/owned-ci-followup-20260930.json";
export const ownedCiFollowupPrevious = Object.freeze({
	path: "docs/evidence/owned-perl-ci-repair-20260930.json"
	, sha256: "4e0bdebc8a07377c8c379678cb67d9ad5ef9fa38e9e2418db332a0eeac7efbe2"
});
export const ownedCiFollowupChangedPaths = [
	"tests/helpers/owned-consumer-ci-repair-evidence.mjs"
	, "tests/helpers/owned-perl-ci-history.mjs"
	, "tests/helpers/owned-perl-profile-history.mjs"
	, "tests/owned-perl-transfer-evidence.test.mjs"
];
export const ownedCiFollowupAddedPaths = ["tests/helpers/owned-ci-followup-history.mjs"];
export const ownedCiFollowupNormalizationPaths = [...new Set([...ownedCiFollowupChangedPaths, ...ownedPhpTransferChangedPaths])].sort();
let cached;

/**
 * Reverse only authenticated, ordered, non-overlapping edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current identities and recorded edits.
 */
export const reverseOwnedCiFollowupUpdate = (source, update) => {
	assert.ok(ownedCiFollowupChangedPaths.includes(update.path), update.path);
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
 * Keep unknown edits visible to every older source receipt.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional historical stopping digest.
 */
export const beforeOwnedCiFollowup = (path, source, expected) => {
	source = beforeOwnedPhpTransfer(path, source, expected);
	if(!ownedCiFollowupChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedCiFollowupPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-ci-followup");
	assert.equal(record.baselineRevision, ownedCiFollowupBaseline);
	assert.deepEqual(record.previous, ownedCiFollowupPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedCiFollowupChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedCiFollowupUpdate(source, update) : source;
};

/**
 * Decode only the repair's declared text files.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedCiFollowupHistoricalBytes = (path, bytes, expected) => ownedCiFollowupNormalizationPaths.includes(path)
	? beforeOwnedCiFollowup(path, bytes.toString("utf8"), expected) : bytes;
