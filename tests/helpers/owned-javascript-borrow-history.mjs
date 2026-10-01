/**
 * Preserve exact predecessor sources across JavaScript borrowed-result support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedWitBorrow, ownedWitBorrowChangedPaths } from "./wit-owned-borrow-history.mjs";

export const ownedJavaScriptBorrowPath = "docs/evidence/owned-javascript-borrows-20261001.json";
export const ownedJavaScriptBorrowBaseline = "49555c6612107ef8e6a3f8f7576312a5c32da894";
export const ownedJavaScriptBorrowPrevious = Object.freeze({
	path: "docs/evidence/owned-php-wasm-borrows-20261001.json"
	, sha256: "1dbd2e8ff37fe0d38431c655a86f6bedac8e9289c22ec975ea6e61796b434aff"
});
export const ownedJavaScriptBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/contributing/testing.md"
	, "docs/javascript-typescript.md", "docs/lean/export-decisions.md"
	, "docs/publish/npm.md", "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json", "package.json"
	, "src/abi/component-owned-wasm.mjs", "src/abi/owned-wasm-control.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/javascript/owned-package.mjs"
	, "src/backends/javascript/owned-wasm-component.mjs"
	, "src/backends/javascript/owned-wasm-layout.mjs"
	, "src/build/javascript-wasm-owned-model.mjs"
	, "src/build/javascript-wasm-owned-sources.mjs"
	, "src/release/component-npm-package.mjs", "src/release/component-runtime.mjs"
	, "src/release/owned-wasm-bindings.mjs", "src/release/owned-wasm-calls.mjs"
	, "tests/helpers/owned-javascript-npm-browser.mjs"
	, "tests/helpers/owned-javascript-wasm-native.mjs"
	, "tests/helpers/owned-php-borrow-history.mjs"
	, "tests/helpers/owned-php-wasm-borrow-history.mjs"
	, "tests/owned-php-wasm-borrow-evidence.test.mjs"
].sort();
export const ownedJavaScriptBorrowAddedPaths = [
	"docs/evidence/owned-javascript-borrows-20261001.md"
	, "src/backends/javascript/owned-wasm-borrows.mjs"
	, "src/release/owned-wasm-borrow-registry.mjs"
	, "tests/fixtures/structured-types/owned-installed-javascript-borrows.mjs"
	, "tests/fixtures/structured-types/owned-javascript-borrow-semantic.mjs"
	, "tests/helpers/owned-javascript-borrow-ci.mjs"
	, "tests/helpers/owned-javascript-borrow-evidence.mjs"
	, "tests/helpers/owned-javascript-borrow-history.mjs"
	, "tests/helpers/owned-javascript-borrow-mutants.mjs"
	, "tests/owned-javascript-borrow-coexistence.test.mjs"
	, "tests/owned-javascript-borrow-evidence.test.mjs"
	, "tests/owned-javascript-borrow-mutants.test.mjs"
	, "tests/owned-javascript-borrow-package.test.mjs"
	, "tests/owned-javascript-borrow-packaging.test.mjs"
	, "tests/owned-javascript-borrows.test.mjs"
	, "tests/owned-wasm-borrow-registry.test.mjs"
].sort();
let cached;
export const ownedJavaScriptBorrowNormalizationPaths = [...new Set([...ownedJavaScriptBorrowChangedPaths, ...ownedWitBorrowChangedPaths])].sort();

/**
 * Reverse exact ordered edit spans, checking both complete source identities.
 *
 * @param source - Current complete text.
 * @param update - Authenticated path, source identities and replacement spans.
 */
export const reverseOwnedJavaScriptBorrowUpdate = (source, update) => {
	assert.ok(ownedJavaScriptBorrowChangedPaths.includes(update.path), update.path);
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
 * Stop at requested identities and leave unrecorded changes visible.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or predecessor text.
 * @param expected - Optional stopping identity.
 */
export const beforeOwnedJavaScriptBorrow = (path, source, expected) => {
	source = beforeOwnedWitBorrow(path, source, expected);
	if(!ownedJavaScriptBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedJavaScriptBorrowPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedJavaScriptBorrowBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedJavaScriptBorrowPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	const record = cached;
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-borrows");
	assert.equal(record.baselineRevision, ownedJavaScriptBorrowBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedJavaScriptBorrowUpdate(source, update) : source;
};

/**
 * Decode only registered text paths and preserve every unrelated byte.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedJavaScriptBorrowHistoricalBytes = (path, bytes, expected) => ownedJavaScriptBorrowNormalizationPaths.includes(path)
	? beforeOwnedJavaScriptBorrow(path, bytes.toString("utf8"), expected) : bytes;
