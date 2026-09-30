/**
 * Preserve prior installed receipts across PHP-Wasm input-transfer support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedPhpWasmTransferBaseline = "7a05e2fa3186112a364df8451d16f5dfa34348c6";
export const ownedPhpWasmTransferPath = "docs/evidence/owned-php-wasm-transfers-20260930.json";
export const ownedPhpWasmTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-php-transfers-20260930.json"
	, sha256: "013f0acf73adc139f9ece51141d8e48b74289efe4f3e6757eaa8c6c0da477fa6"
});
export const ownedPhpWasmTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
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
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-ci-followup-history.mjs"
	, "tests/helpers/owned-php-transfer-history.mjs"
	, "tests/helpers/owned-php-wasm-browser.mjs"
	, "tests/helpers/owned-php-wasm-cli.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/owned-php-transfer-evidence.test.mjs"
	, "tests/owned-php-wasm-documentation.test.mjs"
];
export const ownedPhpWasmTransferAddedPaths = [
	"docs/evidence/owned-php-wasm-transfers-20260930.md"
	, "src/backends/php/owned-zend-input-transfers.mjs"
	, "tests/fixtures/structured-types/owned-installed-php-wasm-transfers.php"
	, "tests/fixtures/structured-types/owned-php-wasm-transfers.php"
	, "tests/helpers/owned-php-wasm-transfer-ci.mjs"
	, "tests/helpers/owned-php-wasm-transfer-evidence.mjs"
	, "tests/helpers/owned-php-wasm-transfer-history.mjs"
	, "tests/helpers/owned-php-wasm-transfer-probe.mjs"
	, "tests/helpers/owned-php-wasm-transfers.mjs"
	, "tests/owned-php-wasm-transfer-evidence.test.mjs"
	, "tests/owned-php-wasm-transfer-packaging.test.mjs"
	, "tests/owned-php-wasm-transfers.test.mjs"
];
let cached;

/**
 * Reverse only authenticated, ordered, non-overlapping edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current identities and recorded edits.
 */
export const reverseOwnedPhpWasmTransferUpdate = (source, update) => {
	assert.ok(ownedPhpWasmTransferChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPhpWasmTransfer = (path, source, expected) => {
	if(!ownedPhpWasmTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPhpWasmTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-wasm-transfers");
	assert.equal(record.baselineRevision, ownedPhpWasmTransferBaseline);
	assert.deepEqual(record.previous, ownedPhpWasmTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpWasmTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPhpWasmTransferUpdate(source, update) : source;
};

/**
 * Decode only the repair's declared text files.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedPhpWasmTransferHistoricalBytes = (path, bytes, expected) => ownedPhpWasmTransferChangedPaths.includes(path)
	? beforeOwnedPhpWasmTransfer(path, bytes.toString("utf8"), expected) : bytes;
