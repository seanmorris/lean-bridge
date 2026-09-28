/**
 * Authenticate verifier optimizations without rewriting installed receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedWitProjection, ownedWitProjectionChangedPaths } from "./wit-owned-projection-history.mjs";

export const coreHistoryBaseline = "6307e03dec4453f3b13a1c58ce4c686f5592f637";
export const coreHistoryPath = "docs/evidence/core-history-performance-20260928.json";
export const coreHistoryPrevious = Object.freeze({
	path: "docs/evidence/owned-javascript-publication-20260928.json"
	, sha256: "e74fa6f1401c7b21e6e66ab0cc809f6e11c1147d6d5c34f869c46ad917c03bc4"
});
export const coreHistoryChangedPaths = [
	"docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/c-structured-callable-source-history.mjs"
	, "tests/helpers/closure-thread-source-history.mjs"
	, "tests/helpers/cpp-structured-callable-source-history.mjs"
	, "tests/helpers/dotnet-recursive-callable-source-history.mjs"
	, "tests/helpers/dotnet-structured-callable-source-history.mjs"
	, "tests/helpers/jvm-probe-repair-history.mjs"
	, "tests/helpers/jvm-recursive-callable-source-history.mjs"
	, "tests/helpers/jvm-structured-callable-source-history.mjs"
	, "tests/helpers/jvm-thread-exit-repair-history.mjs"
	, "tests/helpers/managed-ci-isolation-history.mjs"
	, "tests/helpers/native-fork-repair-history.mjs"
	, "tests/helpers/native-recursive-callable-source-history.mjs"
	, "tests/helpers/npm-structured-callable-source-history.mjs"
	, "tests/helpers/owned-aggregate-source-history.mjs"
	, "tests/helpers/owned-analysis-source-history.mjs"
	, "tests/helpers/owned-c-source-history.mjs"
	, "tests/helpers/owned-ci-source-history.mjs"
	, "tests/helpers/owned-cpp-order-history.mjs"
	, "tests/helpers/owned-cpp-source-history.mjs"
	, "tests/helpers/owned-dotnet-process-history.mjs"
	, "tests/helpers/owned-dotnet-source-history.mjs"
	, "tests/helpers/owned-host-source-history.mjs"
	, "tests/helpers/owned-javascript-coexistence-source-history.mjs"
	, "tests/helpers/owned-javascript-engine-history.mjs"
	, "tests/helpers/owned-javascript-npm-source-history.mjs"
	, "tests/helpers/owned-javascript-publication-history.mjs"
	, "tests/helpers/owned-javascript-wasm-source-history.mjs"
	, "tests/helpers/owned-jvm-source-history.mjs"
	, "tests/helpers/owned-package-source-history.mjs"
	, "tests/helpers/owned-perl-source-history.mjs"
	, "tests/helpers/owned-php-source-history.mjs"
	, "tests/helpers/owned-php-wasm-source-history.mjs"
	, "tests/helpers/owned-python-source-history.mjs"
	, "tests/helpers/owned-reviewed-source-history.mjs"
	, "tests/helpers/owned-ruby-source-history.mjs"
	, "tests/helpers/owned-rust-source-history.mjs"
	, "tests/helpers/owned-wasm32-source-history.mjs"
	, "tests/helpers/owned-zend-bailout-repair-history.mjs"
	, "tests/helpers/perl-contract-repair-history.mjs"
	, "tests/helpers/perl-recursive-callable-source-history.mjs"
	, "tests/helpers/perl-structured-callable-source-history.mjs"
	, "tests/helpers/php-ci-regression-source-history.mjs"
	, "tests/helpers/php-nix-boundary-repair-history.mjs"
	, "tests/helpers/php-recursive-callable-source-history.mjs"
	, "tests/helpers/php-structured-callable-source-history.mjs"
	, "tests/helpers/php-wasm-recursive-callable-source-history.mjs"
	, "tests/helpers/php-wasm-structured-callable-source-history.mjs"
	, "tests/helpers/python-recursive-callable-source-history.mjs"
	, "tests/helpers/python-structured-callable-source-history.mjs"
	, "tests/helpers/ruby-recursive-callable-source-history.mjs"
	, "tests/helpers/ruby-structured-callable-source-history.mjs"
	, "tests/helpers/rust-recursive-callable-source-history.mjs"
	, "tests/helpers/rust-structured-callable-source-history.mjs"
	, "tests/helpers/wit-acceptance-source-history.mjs"
	, "tests/helpers/wit-composition-source-history.mjs"
	, "tests/helpers/wit-host-source-history.mjs"
	, "tests/helpers/wit-package-source-history.mjs"
	, "tests/helpers/wit-recursive-callable-source-history.mjs"
	, "tests/helpers/wit-structured-callable-source-history.mjs"
	, "tests/owned-javascript-publication-evidence.test.mjs"
].sort();
export const coreHistoryAddedPaths = [
	"docs/evidence/core-history-performance-20260928.md"
	, "tests/core-history-performance-evidence.test.mjs"
	, "tests/helpers/core-history-performance-history.mjs"
	, "tests/helpers/source-history-memo.mjs"
	, "tests/source-history-memo.test.mjs"
].sort();
let cached;
export const coreHistoryNormalizationPaths = [...new Set([...coreHistoryChangedPaths, ...ownedWitProjectionChangedPaths])].sort();

/**
 * Reverse exact literal edits while authenticating both complete file versions.
 *
 * @param source - Complete current source text.
 * @param update - Recorded path, identities and ordered replacement spans.
 */
export const reverseCoreHistoryUpdate = (source, update) => {
	assert.ok(coreHistoryChangedPaths.includes(update.path), update.path);
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
	assert.equal(sha256(restored), update.previousSha256, update.path);
	return restored;
};

/**
 * Restore only this measured optimization, never an unknown edit or receipt.
 *
 * @param path - Exact repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping identity.
 */
export const beforeCoreHistoryPerformance = (path, source, expected) => {
	source = beforeOwnedWitProjection(path, source, expected);
	if(!coreHistoryChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(coreHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "core-history-performance");
	assert.equal(record.baselineRevision, coreHistoryBaseline);
	assert.deepEqual(record.previous, coreHistoryPrevious);
	assert.deepEqual(record.updates.map(update => update.path), coreHistoryChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseCoreHistoryUpdate(source, update) : source;
};

/**
 * Normalize declared text paths without decoding unrelated binary artifacts.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete input bytes.
 * @param expected - Optional stopping identity.
 */
export const coreHistoryHistoricalBytes = (path, bytes, expected) => coreHistoryNormalizationPaths.includes(path)
	? beforeCoreHistoryPerformance(path, bytes.toString("utf8"), expected) : bytes;
