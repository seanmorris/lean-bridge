/**
 * Preserve installed Perl evidence across the contract-test registration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedPerlProfileBaseline = "cb7ac24d2134c813561fd8369414935c962d0b43";
export const ownedPerlProfilePath = "docs/evidence/owned-perl-profile-repair-20260930.json";
export const ownedPerlProfilePrevious = Object.freeze({
	path: "docs/evidence/owned-perl-transfers-20260929.json"
	, sha256: "e52eb5370252cc3ecf3c818957a9aad7ca65e87a57aeb8fbf96e20536238bb21"
});
export const ownedPerlProfileChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/owned-jvm-transfer-history.mjs"
	, "tests/helpers/owned-perl-transfer-history.mjs"
	, "tests/owned-perl-transfer-evidence.test.mjs"
];
export const ownedPerlProfileAddedPaths = ["tests/helpers/owned-perl-profile-history.mjs"];
let cached;

/**
 * Reverse only authenticated, ordered, non-overlapping edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current identities and recorded edits.
 */
export const reverseOwnedPerlProfileUpdate = (source, update) => {
	assert.ok(ownedPerlProfileChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPerlProfile = (path, source, expected) => {
	if(!ownedPerlProfileChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPerlProfilePath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-perl-profile-repair");
	assert.equal(record.baselineRevision, ownedPerlProfileBaseline);
	assert.deepEqual(record.previous, ownedPerlProfilePrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedPerlProfileChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPerlProfileUpdate(source, update) : source;
};

/**
 * Decode only the repair's declared text files.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedPerlProfileHistoricalBytes = (path, bytes, expected) => ownedPerlProfileChangedPaths.includes(path)
	? beforeOwnedPerlProfile(path, bytes.toString("utf8"), expected) : bytes;
