/**
 * Preserve installed npm evidence while recording shared-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedAnalysis, ownedAnalysisNormalizationPaths } from "./owned-analysis-source-history.mjs";

export const ownedJavaScriptCoexistenceBaseline = "239fd61ea7664dbfd8191207c6396975e6345726";
export const ownedJavaScriptCoexistenceHistoryPath = "docs/evidence/owned-javascript-coexistence-integration-20260928.json";
export const ownedJavaScriptCoexistencePrevious = Object.freeze({
	path: "docs/evidence/owned-javascript-npm-integration-20260928.json"
	, sha256: "f4317e4bc4922d82b7b7194188eac06bc0a38fb191b4e4afc84419713cd67868"
});
export const ownedJavaScriptCoexistenceChangedPaths = [
	".github/workflows/consumer-matrix.yml", "docs/contributing/testing.md"
	, "docs/javascript-typescript.md", "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs", "src/release/component-npm-package.mjs"
	, "tests/helpers/owned-javascript-npm-source-history.mjs"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/helpers/owned-javascript-wasm-source-history.mjs"
	, "tests/owned-javascript-npm-evidence.test.mjs"
	, "tests/owned-javascript-wasm-ci.test.mjs"
].sort();
export const ownedJavaScriptCoexistenceAddedPaths = [
	"docs/evidence/owned-javascript-npm-coexistence-20260928.md"
	, "tests/component-runtime-package-identity.test.mjs"
	, "tests/helpers/owned-javascript-coexistence-evidence.mjs"
	, "tests/helpers/owned-javascript-coexistence-source-history.mjs"
	, "tests/helpers/owned-javascript-npm-coexistence-browser.mjs"
	, "tests/helpers/owned-javascript-npm-coexistence-probe.mjs"
	, "tests/owned-javascript-coexistence-evidence.test.mjs"
	, "tests/owned-javascript-npm-coexistence.test.mjs"
].sort();
export const ownedJavaScriptCoexistenceNormalizationPaths = [...new Set([...ownedJavaScriptCoexistenceChangedPaths, ...ownedAnalysisNormalizationPaths])].sort();
let cached;

/**
 * Undo only declared literal edits authenticated by both complete file hashes.
 *
 * @param source - Complete current file text.
 * @param update - Exact transition from the preceding committed milestone.
 */
export const reverseOwnedJavaScriptCoexistenceUpdate = (source, update) => {
	assert.ok(ownedJavaScriptCoexistenceChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const parts = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string"); assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current, update.path);
		parts.push(source.slice(end, start), previous); end = start + current.length;
	}
	parts.push(source.slice(end)); const restored = parts.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path); return restored;
};

/**
 * Stop at a requested identity and leave unknown changes visible to verifiers.
 *
 * @param path - Repository-relative path.
 * @param source - Current or historical source text.
 * @param expected - Optional stopping hash.
 */
export const beforeOwnedJavaScriptCoexistence = (path, source, expected) => {
	source = beforeOwnedAnalysis(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !ownedJavaScriptCoexistenceChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedJavaScriptCoexistenceHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-coexistence-integration");
	assert.equal(record.baselineRevision, ownedJavaScriptCoexistenceBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptCoexistencePrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptCoexistenceChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedJavaScriptCoexistenceUpdate(source, update) : source;
};

/**
 * Only declared text transitions can be decoded or normalized.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete file bytes.
 * @param expected - Optional historical identity.
 */
export const ownedJavaScriptCoexistenceHistoricalBytes = (path, bytes, expected) => ownedJavaScriptCoexistenceNormalizationPaths.includes(path)
	? beforeOwnedJavaScriptCoexistence(path, bytes.toString("utf8"), expected) : bytes;
