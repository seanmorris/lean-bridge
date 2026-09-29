/**
 * Preserve frozen receipts across owned npm and WIT CI dependency repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedConsumerCiBaseline = "23dbfd68ae4a1e8593f99f97aa3d2717b4632ca9";
export const ownedConsumerCiPath = "docs/evidence/owned-consumer-ci-repair-20260929.json";
export const ownedConsumerCiPrevious = Object.freeze({
	path: "docs/evidence/owned-rust-transfers-20260929.json"
	, sha256: "05b6839b102dee122a931e80c260d59d70f44eab4735a1cb533882c56705a2e3"
});
export const ownedConsumerCiChangedPaths = [
	".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json", "src/adoption/test-profiles.mjs"
	, "tests/helpers/owned-cpp-transfer-history.mjs"
	, "tests/helpers/owned-rust-transfer-history.mjs"
	, "tests/owned-javascript-nix-installed.test.mjs"
	, "tests/owned-rust-transfer-evidence.test.mjs"
].sort();
export const ownedConsumerCiAddedPaths = [
	"docs/evidence/owned-consumer-ci-repair-20260929.md"
	, "tests/helpers/owned-consumer-ci-repair-evidence.mjs"
	, "tests/helpers/owned-consumer-ci-repair-history.mjs"
	, "tests/owned-consumer-ci-repair.test.mjs"
].sort();
let cached;

/**
 * Authenticate complete sources before reversing exact ordered edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact current and previous identities and reversible edits.
 */
export const reverseOwnedConsumerCiUpdate = (source, update) => {
	assert.ok(ownedConsumerCiChangedPaths.includes(update.path), update.path);
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
 * Preserve unknown changes and stop at explicitly requested historical bytes.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional historical stopping digest.
 */
export const beforeOwnedConsumerCi = (path, source, expected) => {
	if(!ownedConsumerCiChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedConsumerCiPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-consumer-ci-repair");
	assert.equal(record.baselineRevision, ownedConsumerCiBaseline);
	assert.deepEqual(record.previous, ownedConsumerCiPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedConsumerCiChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedConsumerCiUpdate(source, update) : source;
};

/**
 * Decode only registered text paths; preserve unrelated binary inputs.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedConsumerCiHistoricalBytes = (path, bytes, expected) => ownedConsumerCiChangedPaths.includes(path)
	? beforeOwnedConsumerCi(path, bytes.toString("utf8"), expected) : bytes;
