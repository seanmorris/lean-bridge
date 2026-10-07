/**
 * Authenticate the owned WIT projection without rewriting installed receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedJavaScriptNix, ownedJavaScriptNixNormalizationPaths } from "./owned-javascript-nix-history.mjs";
import { beforePostPerlCallbackStaging
	, postPerlCallbackNormalizationPaths } from "./post-perl-callback-staging-history.mjs";

export const ownedWitProjectionBaseline = "4103db9893bd8addb0715cd74f856b3c961bafe9";
export const ownedWitProjectionPath = "docs/evidence/wit-owned-projection-20260928.json";
export const ownedWitProjectionPrevious = Object.freeze({
	path: "docs/evidence/core-history-performance-20260928.json"
	, sha256: "3b4e08bca14c73fb07c646a4817871911e04d1a5ce9d823699e3a7bc7a3840ca"
});
export const ownedWitProjectionChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/contributing/testing.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "src/adoption/test-profiles.mjs", "src/backends/wit/copied-component.mjs"
	, "tests/core-history-performance-evidence.test.mjs"
	, "tests/helpers/core-history-performance-history.mjs"
	, "tests/helpers/owned-javascript-publication-history.mjs"
].sort();
export const ownedWitProjectionAddedPaths = [
	"docs/evidence/wit-owned-projection-20260928.md"
	, "src/backends/wit/canonical-borrow-drops.mjs"
	, "src/backends/wit/owned-graph-model.mjs"
	, "src/backends/wit/owned-graph-types.mjs"
	, "tests/fixtures/structured-types/wit-owned-borrow-probe.c"
	, "tests/helpers/wit-owned-canonical-fixture.mjs"
	, "tests/helpers/wit-owned-projection-history.mjs"
	, "tests/wit-owned-canonical.test.mjs", "tests/wit-owned-graph-model.test.mjs"
	, "tests/wit-owned-projection-evidence.test.mjs"
].sort();
let cached;
export const ownedWitProjectionNormalizationPaths = [...new Set([
	...ownedWitProjectionChangedPaths, ...ownedJavaScriptNixNormalizationPaths
	, ...postPerlCallbackNormalizationPaths
])].sort();

/**
 * Reverse exact nonoverlapping spans, authenticating both complete file versions.
 *
 * @param source - Complete current source text.
 * @param update - Recorded path, full hashes and ordered replacement spans.
 */
export const reverseOwnedWitProjectionUpdate = (source, update) => {
	assert.ok(ownedWitProjectionChangedPaths.includes(update.path), update.path);
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
 * Restore a known predecessor while preserving unknown text for its verifier.
 *
 * @param path - Exact repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping identity.
 */
export const beforeOwnedWitProjection = (path, source, expected) => {
	source = beforePostPerlCallbackStaging(path, source, expected);
	source = beforeOwnedJavaScriptNix(path, source, expected);
	if(!ownedWitProjectionChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedWitProjectionPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-projection");
	assert.equal(record.baselineRevision, ownedWitProjectionBaseline);
	assert.deepEqual(record.previous, ownedWitProjectionPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitProjectionChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedWitProjectionUpdate(source, update) : source;
};

/**
 * Decode only registered text paths and leave other binary evidence untouched.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete file contents.
 * @param expected - Optional exact stopping identity.
 */
export const ownedWitProjectionHistoricalBytes = (path, bytes, expected) => ownedWitProjectionNormalizationPaths.includes(path)
	? beforeOwnedWitProjection(path, bytes.toString("utf8"), expected) : bytes;
