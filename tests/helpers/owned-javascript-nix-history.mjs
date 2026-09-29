/**
 * Authenticate real Nix acceptance without replacing prior release receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedJavaScriptNixBaseline = "f79432dac08bcaf4a7ff6d6c369956961ad2d391";
export const ownedJavaScriptNixPath = "docs/evidence/owned-javascript-nix-20260928.json";
export const ownedJavaScriptNixPrevious = Object.freeze({
	path: "docs/evidence/wit-owned-projection-20260928.json"
	, sha256: "82f687eab1485ad0c05540887a4c686417ac06db207f0a8653f458c04b41830d"
});
export const ownedJavaScriptNixChangedPaths = [
	".github/workflows/consumer-matrix.yml", "docs/contributing/testing.md"
	, "docs/publish/npm.md", "docs/type-surface.v1.json", "nix/wasm-toolchain.nix"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/core-history-performance-history.mjs"
	, "tests/helpers/wit-owned-projection-history.mjs"
	, "tests/wit-owned-projection-evidence.test.mjs"
].sort();
export const ownedJavaScriptNixAddedPaths = [
	"docs/evidence/owned-javascript-nix-20260928.md"
	, "tests/helpers/owned-javascript-nix-evidence.mjs"
	, "tests/helpers/owned-javascript-nix-history.mjs"
	, "tests/nix-toolchain-installation.test.mjs"
	, "tests/owned-javascript-nix-evidence.test.mjs"
	, "tests/owned-javascript-nix-installed.test.mjs"
].sort();
let cached;

/**
 * Reverse authenticated, nonoverlapping text spans to the exact prior source.
 *
 * @param source - Complete current source text.
 * @param update - Recorded full hashes and ordered replacement spans.
 */
export const reverseOwnedJavaScriptNixUpdate = (source, update) => {
	assert.ok(ownedJavaScriptNixChangedPaths.includes(update.path), update.path);
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
 * Restore this exact milestone, preserving unknown edits for caller rejection.
 *
 * @param path - Exact repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping identity.
 */
export const beforeOwnedJavaScriptNix = (path, source, expected) => {
	if(!ownedJavaScriptNixChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedJavaScriptNixPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-nix");
	assert.equal(record.baselineRevision, ownedJavaScriptNixBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptNixPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptNixChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedJavaScriptNixUpdate(source, update) : source;
};

/**
 * Normalize only registered text paths, retaining unrelated binary bytes.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete file contents.
 * @param expected - Optional exact stopping identity.
 */
export const ownedJavaScriptNixHistoricalBytes = (path, bytes, expected) => ownedJavaScriptNixChangedPaths.includes(path)
	? beforeOwnedJavaScriptNix(path, bytes.toString("utf8"), expected) : bytes;
