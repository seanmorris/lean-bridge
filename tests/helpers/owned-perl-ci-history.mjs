/**
 * Preserve installed Perl evidence across the CI script-expansion repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedCiFollowup, ownedCiFollowupChangedPaths } from "./owned-ci-followup-history.mjs";

export const ownedPerlCiBaseline = "29b8e25a1609031a6e8af1113a31ceb1458fe493";
export const ownedPerlCiPath = "docs/evidence/owned-perl-ci-repair-20260930.json";
export const ownedPerlCiPrevious = Object.freeze({
	path: "docs/evidence/owned-perl-profile-repair-20260930.json"
	, sha256: "8e87b752f02dc802255f0c462b7e7554e3f10e19f97988adcf98e984030b9630"
});
export const ownedPerlCiChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/dotnet-recursive-callable-evidence.test.mjs"
	, "tests/helpers/owned-perl-profile-history.mjs"
	, "tests/helpers/owned-perl-transfer-history.mjs"
	, "tests/owned-perl-transfer-evidence.test.mjs"
];
export const ownedPerlCiAddedPaths = ["tests/helpers/owned-perl-ci-history.mjs"];
export const ownedPerlCiNormalizationPaths = [...new Set([...ownedPerlCiChangedPaths, ...ownedCiFollowupChangedPaths])].sort();
let cached;

/**
 * Reverse only authenticated, ordered, non-overlapping edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current identities and recorded edits.
 */
export const reverseOwnedPerlCiUpdate = (source, update) => {
	assert.ok(ownedPerlCiChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPerlCi = (path, source, expected) => {
	source = beforeOwnedCiFollowup(path, source, expected);
	if(!ownedPerlCiChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPerlCiPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-perl-ci-repair");
	assert.equal(record.baselineRevision, ownedPerlCiBaseline);
	assert.deepEqual(record.previous, ownedPerlCiPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedPerlCiChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPerlCiUpdate(source, update) : source;
};

/**
 * Decode only the repair's declared text files.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedPerlCiHistoricalBytes = (path, bytes, expected) => ownedPerlCiNormalizationPaths.includes(path)
	? beforeOwnedPerlCi(path, bytes.toString("utf8"), expected) : bytes;
