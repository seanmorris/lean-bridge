/**
 * Preserve source receipts across the structured-callback documentation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeManagedClose, managedCloseNormalizationPaths } from "./managed-close-history.mjs";

export const structuredDocsCiPath = "docs/evidence/structured-docs-ci-repair-20260930.json";
export const structuredDocsCiBaseline = "f88043186b944a3f3bd0133d5e49efd5ff034c69";
export const structuredDocsCiPrevious = Object.freeze({
	path: "docs/evidence/owned-dotnet-lifetime-repair-20260930.json"
	, sha256: "e9e99359143fb9aa2ce907ddb530d4339f7ce7cb7d1ec6d0add1618b99572567"
});
export const structuredDocsCiChangedPaths = [
	"docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
	, "tests/component-structured-callables.test.mjs"
	, "tests/helpers/npm-structured-callable-evidence.mjs"
	, "tests/helpers/owned-dotnet-lifetime-history.mjs"
	, "tests/helpers/owned-jvm-borrow-history.mjs"
	, "tests/owned-dotnet-lifetime-evidence.test.mjs"
].sort();
export const structuredDocsCiAddedPaths = [
	"docs/evidence/structured-docs-ci-repair-20260930.md"
	, "tests/component-structured-callable-documentation.test.mjs"
	, "tests/helpers/npm-structured-callable-documentation.mjs"
	, "tests/helpers/structured-docs-ci-evidence.mjs"
	, "tests/helpers/structured-docs-ci-history.mjs"
	, "tests/structured-docs-ci-evidence.test.mjs"
].sort();
let cached;
export const structuredDocsCiNormalizationPaths = [...new Set([...structuredDocsCiChangedPaths, ...managedCloseNormalizationPaths])].sort();

/**
 * Reverse complete authenticated versions through exact ordered source edits.
 *
 * @param source - Complete current source.
 * @param update - Before/after hashes and replacement spans.
 */
export const reverseStructuredDocsCiUpdate = (source, update) => {
	assert.ok(structuredDocsCiChangedPaths.includes(update.path), update.path);
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
 * Stop at the requested identity and leave unknown changes visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeStructuredDocsCi = (path, source, expected) => {
	source = beforeManagedClose(path, source, expected);
	if(!structuredDocsCiChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(structuredDocsCiPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "structured-docs-ci-repair");
	assert.equal(record.baselineRevision, structuredDocsCiBaseline);
	assert.deepEqual(record.previous, structuredDocsCiPrevious);
	assert.deepEqual(record.updates.map(update => update.path), structuredDocsCiChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseStructuredDocsCiUpdate(source, update) : source;
};

/**
 * Decode registered text only, preserving all unrelated bytes.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete current source bytes.
 * @param expected - Optional stopping digest.
 */
export const structuredDocsCiHistoricalBytes = (path, bytes, expected) => structuredDocsCiNormalizationPaths.includes(path)
	? beforeStructuredDocsCi(path, bytes.toString("utf8"), expected) : bytes;
