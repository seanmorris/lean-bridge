/**
 * Preserve authenticated source versions across PHP-Wasm borrowed results.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedJavaScriptBorrow, ownedJavaScriptBorrowNormalizationPaths } from "./owned-javascript-borrow-history.mjs";

export const ownedPhpWasmBorrowPath = "docs/evidence/owned-php-wasm-borrows-20261001.json";
export const ownedPhpWasmBorrowBaseline = "3da93d67603c56529d9b4dce76f53ae60a8fdf51";
export const ownedPhpWasmBorrowPrevious = Object.freeze({
	path: "docs/evidence/owned-php-borrows-20261001.json"
	, sha256: "a0f8d24c2d5a5e4edebd69cc518d39d5530c1209a3560e45c0ab9a46306ac1b9"
});
export const ownedPhpWasmBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md", "docs/php.md", "docs/publish/php.md"
	, "docs/type-surface.v1.json", "package.json", "src/adoption/test-profiles.mjs"
	, "src/backends/php/owned-zend-callbacks.mjs"
	, "src/backends/php/owned-zend-extension.mjs"
	, "src/backends/php/owned-zend-model.mjs"
	, "src/backends/php/owned-zend-ownership.mjs"
	, "src/backends/php/owned-zend-php.mjs"
	, "src/backends/php/owned-zend-readme.mjs"
	, "src/backends/php/owned-zend-walk.mjs"
	, "src/build/multi-profile-project.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-owned-component.mjs"
	, "src/build/php-wasm-owned-model.mjs"
	, "src/release/php-wasm-copied-package.mjs", "tests/documentation.test.mjs"
	, "tests/helpers/owned-perl-borrow-history.mjs"
	, "tests/helpers/owned-php-borrow-history.mjs"
	, "tests/helpers/owned-php-wasm-browser.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/helpers/owned-php-wasm-transfer-probe.mjs"
	, "tests/owned-php-borrow-evidence.test.mjs"
].sort();
export const ownedPhpWasmBorrowAddedPaths = [
	"docs/evidence/owned-php-wasm-borrows-20261001.md"
	, "src/backends/php/owned-zend-borrow-calls.mjs"
	, "src/backends/php/owned-zend-borrows.mjs"
	, "tests/fixtures/structured-types/owned-php-wasm-borrow-bailouts.php"
	, "tests/fixtures/structured-types/owned-php-wasm-borrow-checkpoints.php"
	, "tests/fixtures/structured-types/owned-php-wasm-borrow-fibers.php"
	, "tests/fixtures/structured-types/owned-php-wasm-borrow-only.php"
	, "tests/fixtures/structured-types/owned-php-wasm-borrow-recovery.php"
	, "tests/fixtures/structured-types/owned-php-wasm-borrows.php"
	, "tests/helpers/owned-php-wasm-borrow-ci.mjs"
	, "tests/helpers/owned-php-wasm-borrow-evidence.mjs"
	, "tests/helpers/owned-php-wasm-borrow-fibers.mjs"
	, "tests/helpers/owned-php-wasm-borrow-history.mjs"
	, "tests/helpers/owned-php-wasm-borrow-mutants.mjs"
	, "tests/helpers/owned-php-wasm-borrows.mjs"
	, "tests/owned-php-wasm-borrow-documentation.test.mjs"
	, "tests/owned-php-wasm-borrow-evidence.test.mjs"
	, "tests/owned-php-wasm-borrow-packaging.test.mjs"
	, "tests/owned-php-wasm-borrows.test.mjs"
].sort();
let cached;
export const ownedPhpWasmBorrowNormalizationPaths = [...new Set([...ownedPhpWasmBorrowChangedPaths, ...ownedJavaScriptBorrowNormalizationPaths])].sort();

/**
 * Reverse exact ordered edit spans, checking both complete source identities.
 *
 * @param source - Complete current source.
 * @param update - Registered path, source digests and replacement spans.
 */
export const reverseOwnedPhpWasmBorrowUpdate = (source, update) => {
	assert.ok(ownedPhpWasmBorrowChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPhpWasmBorrow = (path, source, expected) => {
	source = beforeOwnedJavaScriptBorrow(path, source, expected);
	if(!ownedPhpWasmBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedPhpWasmBorrowPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedPhpWasmBorrowBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedPhpWasmBorrowPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	const record = cached;
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-wasm-borrows");
	assert.equal(record.baselineRevision, ownedPhpWasmBorrowBaseline);
	assert.deepEqual(record.previous, ownedPhpWasmBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpWasmBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedPhpWasmBorrowUpdate(source, update) : source;
};

/**
 * Decode registered text paths only; preserve unrelated files unchanged.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedPhpWasmBorrowHistoricalBytes = (path, bytes, expected) => ownedPhpWasmBorrowNormalizationPaths.includes(path)
	? beforeOwnedPhpWasmBorrow(path, bytes.toString("utf8"), expected) : bytes;
