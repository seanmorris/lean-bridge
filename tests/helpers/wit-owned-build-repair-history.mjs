/**
 * Preserve source-bound receipts across the owned WIT build regression repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedTransferC, ownedTransferCNormalizationPaths } from "./owned-transfer-c-history.mjs";

export const ownedWitBuildRepairBaseline = "2313a9d9a95ba980191a0c516db6ae7da7745a7e";
export const ownedWitBuildRepairPath = "docs/evidence/wit-owned-build-repair-20260929.json";
export const ownedWitBuildRepairPrevious = Object.freeze({
	path: "docs/evidence/wit-owned-packages-20260929.json"
	, sha256: "77f943e2c16cec294cdac79366df91cc0aa2a81e6685f8504978411cf50a1a35"
});
export const ownedWitBuildRepairChangedPaths = [
	"docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/wit-owned-package-history.mjs"
	, "tests/helpers/wit-owned-session-history.mjs"
	, "tests/owned-javascript-cli.test.mjs", "tests/owned-php-wasm-cli.test.mjs"
	, "tests/wit-owned-package-evidence.test.mjs"
].sort();
export const ownedWitBuildRepairAddedPaths = [
	"docs/evidence/wit-owned-build-repair-20260929.md"
	, "tests/helpers/wit-owned-build-repair-evidence.mjs"
	, "tests/helpers/wit-owned-build-repair-history.mjs"
	, "tests/wit-owned-build-repair-evidence.test.mjs"
].sort();
let cached;
export const ownedWitBuildRepairNormalizationPaths = [...new Set([...ownedWitBuildRepairChangedPaths, ...ownedTransferCNormalizationPaths])].sort();

/**
 * Reverse ordered spans only after authenticating both complete file versions.
 *
 * @param source - Complete current source text.
 * @param update - Full file hashes and ordered replacement spans.
 */
export const reverseOwnedWitBuildRepairUpdate = (source, update) => {
	assert.ok(ownedWitBuildRepairChangedPaths.includes(update.path), update.path);
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
 * Keep unrecorded edits visible to every earlier receipt verifier.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact historical stopping identity.
 */
export const beforeOwnedWitBuildRepair = (path, source, expected) => {
	source = beforeOwnedTransferC(path, source, expected);
	if(!ownedWitBuildRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedWitBuildRepairPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-build-repair");
	assert.equal(record.baselineRevision, ownedWitBuildRepairBaseline);
	assert.deepEqual(record.previous, ownedWitBuildRepairPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitBuildRepairChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedWitBuildRepairUpdate(source, update) : source;
};

/**
 * Decode recorded text paths only, preserving unrelated binary bytes.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional exact historical stopping identity.
 */
export const ownedWitBuildRepairHistoricalBytes = (path, bytes, expected) => ownedWitBuildRepairNormalizationPaths.includes(path)
	? beforeOwnedWitBuildRepair(path, bytes.toString("utf8"), expected) : bytes;
