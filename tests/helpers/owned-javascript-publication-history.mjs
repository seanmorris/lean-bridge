/**
 * Authenticate the owned publication successor without rewriting prior receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedJavaScriptPublicationBaseline = "471a4dc971303143025d60aa988397313d549bdb";
export const ownedJavaScriptPublicationHistoryPath = "docs/evidence/owned-javascript-publication-20260928.json";
export const ownedJavaScriptPublicationPrevious = Object.freeze({
	path: "docs/evidence/owned-javascript-engine-integration-20260928.json"
	, sha256: "2299de677d5fc10e729e8b12660d2b2625c678b01c4156c6f93248aa08cd88e5"
});
export const ownedJavaScriptPublicationBaselineSources = Object.freeze({
	"src/release/component-publication.mjs": "4d7d2cf1a5511ea068bbc53a50840a332b9f11f71b2e8e174a0d6d6da3772e0a"
	, "src/release/component-reproducibility-gate.mjs": "6445ad76c4ee77cb24cb85de1b0d5175ae6a94ee2efec38b0828ec9fdb439f27"
	, "src/release/publication-attestation.mjs": "1ecb1b7f1fe8adbf32c3b90db435ffe5712130c71c7c5f1d7f0fdd573fb216bb"
	, "src/release/release-receipt.mjs": "67958d5529d215c5a73ac672837bc0766ca726a2bc96da8b5684fe4ba844a559"
	, "tests/lean-project-analyzer.test.mjs": "f55f8d21f20ac2182d0dbb1766427a435bf26bece6fa32d84cdc3a8441f683fb"
});
export const ownedJavaScriptPublicationChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/contributing/testing.md", "docs/publish/npm.md"
	, "docs/type-surface.v1.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, "src/build/javascript-wasm-owned-project.mjs"
	, "src/release/component-publication.mjs"
	, "src/release/component-reproducibility-gate.mjs"
	, "src/release/owned-javascript-npm-package.mjs"
	, "src/release/publication-attestation.mjs", "src/release/release-receipt.mjs"
	, "tests/helpers/owned-javascript-engine-history.mjs"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/helpers/owned-zend-bailout-repair-history.mjs"
	, "tests/lean-project-analyzer.test.mjs"
	, "tests/owned-javascript-engine-evidence.test.mjs"
	, "tests/owned-javascript-wasm-ci.test.mjs"
].sort();
export const ownedJavaScriptPublicationAddedPaths = [
	"docs/evidence/owned-javascript-publication-20260928.md"
	, "src/release/owned-javascript-publication.mjs"
	, "src/release/owned-javascript-release-evidence.mjs"
	, "tests/helpers/owned-javascript-publication-evidence.mjs"
	, "tests/helpers/owned-javascript-publication-history.mjs"
	, "tests/owned-javascript-publication-evidence.test.mjs"
	, "tests/owned-javascript-publication.test.mjs"
].sort();
let cached;

/**
 * Reverse ordered literal edits only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated path, identities and literal edits.
 */
export const reverseOwnedJavaScriptPublicationUpdate = (source, update) => {
	assert.ok(ownedJavaScriptPublicationChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const parts = []; let end = 0;
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
 * Restore a known predecessor while leaving every unrecorded change visible.
 *
 * @param path - Exact repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping identity.
 */
export const beforeOwnedJavaScriptPublication = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !ownedJavaScriptPublicationChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedJavaScriptPublicationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-publication");
	assert.equal(record.baselineRevision, ownedJavaScriptPublicationBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptPublicationPrevious);
	assert.deepEqual(record.baselineSources, ownedJavaScriptPublicationBaselineSources);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptPublicationChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedJavaScriptPublicationUpdate(source, update) : source;
};

/**
 * Normalize declared text paths without decoding unrelated binary inputs.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete file bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedJavaScriptPublicationHistoricalBytes = (path, bytes, expected) => ownedJavaScriptPublicationChangedPaths.includes(path)
	? beforeOwnedJavaScriptPublication(path, bytes.toString("utf8"), expected) : bytes;
