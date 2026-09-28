/**
 * Preserve the native PHP receipt across explicit wasm32 ownership support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeJvmThreadExitRepair, jvmThreadExitNormalizationPaths } from "./jvm-thread-exit-repair-history.mjs";

export const ownedWasm32Baseline = "8261ccfbb22152dda4a4edef00aa161f3958ec78";
export const ownedWasm32HistoryPath = "docs/evidence/owned-wasm32-transport-20260928.json";
export const ownedWasm32Previous = Object.freeze({
	path: "docs/evidence/owned-php-integration-20260928.json"
	, sha256: "94a9dd414fc0f2938bf2e6595a08776bbdac232caaf2c479acb61fb4ea0ca6a0"
});
export const ownedWasm32ChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/contributing/testing.md", "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/backends/native/owned-value-layout.mjs"
	, "src/backends/native/owned-value-runtime.mjs"
	, "tests/helpers/owned-php-source-history.mjs"
	, "tests/helpers/perl-contract-repair-history.mjs"
	, "tests/owned-php-package-evidence.test.mjs"
].sort();
export const ownedWasm32AddedPaths = [
	"docs/evidence/owned-wasm32-transport-20260928.md"
	, "tests/helpers/owned-wasm32-evidence.mjs"
	, "tests/helpers/owned-wasm32-probes.mjs"
	, "tests/helpers/owned-wasm32-source-history.mjs"
	, "tests/helpers/owned-wasm32-transport.mjs"
	, "tests/owned-wasm32-evidence.test.mjs"
	, "tests/owned-wasm32-transport.test.mjs"
].sort();
let cached;
export const ownedWasm32NormalizationPaths = [...new Set([...ownedWasm32ChangedPaths, ...jvmThreadExitNormalizationPaths])].sort();

/**
 * Reverse exact edits only after authenticating both complete file identities.
 *
 * @param source - Complete current text.
 * @param update - Ordered literal edits and whole-file identities.
 */
export const reverseOwnedWasm32Update = (source, update) => {
	assert.ok(ownedWasm32ChangedPaths.includes(update.path), update.path);
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
 * Restore a known predecessor while leaving unrecorded source changes visible.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact identity at which to stop.
 */
export const beforeOwnedWasm32 = (path, source, expected) => {
	source = beforeJvmThreadExitRepair(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !ownedWasm32ChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedWasm32HistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "owned-wasm32-transport");
	assert.equal(record.baselineRevision, ownedWasm32Baseline);
	assert.deepEqual(record.previous, ownedWasm32Previous);
	assert.deepEqual(record.updates.map(item => item.path), ownedWasm32ChangedPaths);
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedWasm32Update(source, update) : source;
};

/**
 * Normalize declared text files without changing unrelated bytes.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Optional exact predecessor identity.
 */
export const ownedWasm32HistoricalBytes = (path, bytes, expected) => ownedWasm32NormalizationPaths.includes(path)
	? beforeOwnedWasm32(path, bytes.toString("utf8"), expected) : bytes;
