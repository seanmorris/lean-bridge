/**
 * Preserve frozen receipts across the native PHP import-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const phpNixBoundaryBaseline = "f2e2c6a324bc52cb4c34efdcef120c1b3cce8fe6";
export const phpNixBoundaryHistoryPath = "docs/evidence/php-nix-boundary-repair-20260928.json";
export const phpNixBoundaryPrevious = Object.freeze({
	path: "docs/evidence/jvm-thread-exit-repair-20260928.json"
	, sha256: "023e3bf3b4ad63af18eae664ad7c8def5e1274c789eaa2312961f94a7bad5ddb"
});
export const phpNixBoundaryChangedPaths = [
	"docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/jvm-thread-exit-repair-history.mjs"
	, "tests/helpers/owned-wasm32-source-history.mjs"
	, "tests/jvm-thread-exit-repair-evidence.test.mjs"
].sort();
export const phpNixBoundaryAddedPaths = [
	"docs/evidence/php-nix-boundary-repair-20260928.md"
	, "tests/helpers/php-nix-boundary-repair-evidence.mjs"
	, "tests/helpers/php-nix-boundary-repair-history.mjs"
	, "tests/php-nix-boundary-repair-evidence.test.mjs"
].sort();
let cached;

/**
 * Reverse exact literal edits after checking both complete source identities.
 *
 * @param source - Complete current source text.
 * @param update - Ordered edits and complete current/predecessor hashes.
 */
export const reversePhpNixBoundaryUpdate = (source, update) => {
	assert.ok(phpNixBoundaryChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const pieces = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current, update.path);
		pieces.push(source.slice(end, start), previous); end = start + current.length;
	}
	pieces.push(source.slice(end)); const restored = pieces.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path);
	return restored;
};

/**
 * Restore a recorded predecessor and leave every unrecorded edit visible.
 *
 * @param path - Exact repository-relative path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact identity at which to stop.
 */
export const beforePhpNixBoundaryRepair = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !phpNixBoundaryChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(phpNixBoundaryHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "php-nix-boundary-repair");
	assert.equal(record.baselineRevision, phpNixBoundaryBaseline);
	assert.deepEqual(record.previous, phpNixBoundaryPrevious);
	assert.deepEqual(record.updates.map(item => item.path), phpNixBoundaryChangedPaths);
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpNixBoundaryUpdate(source, update) : source;
};

/**
 * Normalize declared text files only; preserve unrelated bytes.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Optional exact predecessor identity.
 */
export const phpNixBoundaryHistoricalBytes = (path, bytes, expected) => phpNixBoundaryChangedPaths.includes(path)
	? beforePhpNixBoundaryRepair(path, bytes.toString("utf8"), expected) : bytes;
