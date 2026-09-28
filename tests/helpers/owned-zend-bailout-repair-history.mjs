/**
 * Preserve exact structured-type evidence across the native Zend probe repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedJavaScriptEngine, ownedJavaScriptEngineChangedPaths } from "./owned-javascript-engine-history.mjs";

export const ownedZendBailoutBaseline = "c3a114694ba80a22db7fdee55fce3003bda77f23";
export const ownedZendBailoutHistoryPath = "docs/evidence/owned-zend-bailout-repair-20260928.json";
export const ownedZendBailoutPrevious = Object.freeze({
	path: "docs/evidence/owned-analysis-integration-20260928.json"
	, sha256: "59f7b6db9d69c0219f38433cab0fad3cea4b3f242330027c717a2ec585b47dc8"
});
export const ownedZendBailoutChangedPaths = [
	"docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
	, "tests/helpers/owned-analysis-source-history.mjs"
	, "tests/helpers/owned-javascript-coexistence-source-history.mjs"
	, "tests/helpers/owned-php-zend-native.mjs"
	, "tests/helpers/owned-php-zend-ownership-probe.mjs"
	, "tests/owned-analysis-evidence.test.mjs"
].sort();
export const ownedZendBailoutAddedPaths = [
	"docs/evidence/owned-zend-bailout-repair-20260928.md"
	, "tests/helpers/owned-zend-bailout-repair-evidence.mjs"
	, "tests/helpers/owned-zend-bailout-repair-history.mjs"
	, "tests/owned-zend-bailout-repair.test.mjs"
].sort();
let cached;
export const ownedZendBailoutNormalizationPaths = [...new Set([...ownedZendBailoutChangedPaths, ...ownedJavaScriptEngineChangedPaths])].sort();

/**
 * Undo only complete authenticated sources and ordered literal edits.
 *
 * @param source - Current complete source text.
 * @param update - Closed path, identities and literal changes.
 */
export const reverseOwnedZendBailoutUpdate = (source, update) => {
	assert.ok(ownedZendBailoutChangedPaths.includes(update.path), update.path);
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
 * Restore known predecessor bytes while keeping unknown edits visible.
 *
 * @param path - Exact repository-relative path.
 * @param source - Current or historical source text.
 * @param expected - Optional stopping identity.
 */
export const beforeOwnedZendBailoutRepair = (path, source, expected) => {
	source = beforeOwnedJavaScriptEngine(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !ownedZendBailoutChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedZendBailoutHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-zend-bailout-repair");
	assert.equal(record.baselineRevision, ownedZendBailoutBaseline);
	assert.deepEqual(record.previous, ownedZendBailoutPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedZendBailoutChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedZendBailoutUpdate(source, update) : source;
};

/**
 * Decode only the declared text paths and preserve unrelated bytes.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedZendBailoutHistoricalBytes = (path, bytes, expected) => ownedZendBailoutNormalizationPaths.includes(path)
	? beforeOwnedZendBailoutRepair(path, bytes.toString("utf8"), expected) : bytes;
