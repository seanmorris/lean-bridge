/**
 * Preserve prior receipts across JavaScript/TypeScript input-transfer support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedWitTransfer, ownedWitTransferChangedPaths } from "./wit-owned-transfer-history.mjs";

export const ownedJavaScriptTransferBaseline = "10463a29b72d47b01e11cc799d97589f2ca594fe";
export const ownedJavaScriptTransferPath = "docs/evidence/owned-javascript-transfers-20260930.json";
export const ownedJavaScriptTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-php-wasm-transfers-20260930.json"
	, sha256: "6b276e7435f5c50629604d623d944e61ab2e5b81ffe93e711979dc8f5c51b64b"
});
export const ownedJavaScriptTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/contributing/testing.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/npm.md"
	, "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "package.json"
	, "src/abi/component-owned-wasm.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/javascript/owned-package.mjs"
	, "src/backends/javascript/owned-wasm-component.mjs"
	, "src/backends/javascript/owned-wasm-layout.mjs"
	, "src/build/javascript-wasm-owned-model.mjs"
	, "src/build/javascript-wasm-owned-sources.mjs"
	, "src/release/component-runtime.mjs"
	, "src/release/owned-wasm-bindings.mjs"
	, "src/release/owned-wasm-calls.mjs"
	, "src/release/owned-wasm-registry.mjs"
	, "tests/helpers/owned-javascript-npm-browser.mjs"
	, "tests/helpers/owned-javascript-wasm-native.mjs"
	, "tests/helpers/owned-php-transfer-history.mjs"
	, "tests/helpers/owned-php-wasm-transfer-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/owned-php-wasm-transfer-evidence.test.mjs"
	, "tests/owned-wasm-registry.test.mjs"
];
export const ownedJavaScriptTransferAddedPaths = [
	"docs/evidence/owned-javascript-transfers-20260930.md"
	, "src/backends/javascript/owned-wasm-input-transfers.mjs"
	, "tests/fixtures/structured-types/owned-installed-javascript-transfers.mjs"
	, "tests/helpers/owned-javascript-transfer-ci.mjs"
	, "tests/helpers/owned-javascript-transfer-evidence.mjs"
	, "tests/helpers/owned-javascript-transfer-history.mjs"
	, "tests/owned-javascript-transfer-evidence.test.mjs"
	, "tests/owned-javascript-transfer-packaging.test.mjs"
	, "tests/owned-javascript-transfers.test.mjs"
];
export const ownedJavaScriptTransferNormalizationPaths = [...new Set([...ownedJavaScriptTransferChangedPaths, ...ownedWitTransferChangedPaths])].sort();
let cached;

/**
 * Reverse only authenticated, ordered, non-overlapping edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current identities and recorded edits.
 */
export const reverseOwnedJavaScriptTransferUpdate = (source, update) => {
	assert.ok(ownedJavaScriptTransferChangedPaths.includes(update.path), update.path);
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
 * Keep unknown edits visible to every older source receipt.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional historical stopping digest.
 */
export const beforeOwnedJavaScriptTransfer = (path, source, expected) => {
	source = beforeOwnedWitTransfer(path, source, expected);
	if(!ownedJavaScriptTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedJavaScriptTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-transfers");
	assert.equal(record.baselineRevision, ownedJavaScriptTransferBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedJavaScriptTransferUpdate(source, update) : source;
};

/**
 * Decode only this milestone's declared text files.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedJavaScriptTransferHistoricalBytes = (path, bytes, expected) => ownedJavaScriptTransferNormalizationPaths.includes(path)
	? beforeOwnedJavaScriptTransfer(path, bytes.toString("utf8"), expected) : bytes;
