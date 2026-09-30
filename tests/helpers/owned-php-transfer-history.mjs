/**
 * Preserve prior installed receipts across native PHP input-transfer support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedPhpWasmTransfer, ownedPhpWasmTransferChangedPaths } from "./owned-php-wasm-transfer-history.mjs";

export const ownedPhpTransferBaseline = "ff28039c497d97fdcb3496299f8357ee8674c358";
export const ownedPhpTransferPath = "docs/evidence/owned-php-transfers-20260930.json";
export const ownedPhpTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-ci-followup-20260930.json"
	, sha256: "fbc2b83c0f0df0517f52de4c3ed69fbb12f625ec8e98d2bb295c79d0a0d23715"
});
export const ownedPhpTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/php/owned-call-runtime.mjs"
	, "src/backends/php/owned-calls.mjs"
	, "src/backends/php/owned-conversion-support.mjs"
	, "src/backends/php/owned-conversions.mjs"
	, "src/backends/php/owned-package.mjs"
	, "src/backends/php/owned-runtime.mjs"
	, "src/backends/php/owned-values.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-php-artifacts.mjs"
	, "src/build/owned-php-projection.mjs"
	, "src/release/owned-composer.mjs"
	, "tests/helpers/owned-ci-followup-history.mjs"
	, "tests/helpers/owned-perl-ci-history.mjs"
	, "tests/helpers/owned-php-native.mjs"
	, "tests/owned-perl-transfer-evidence.test.mjs"
	, "tests/owned-php-documentation.test.mjs"
];
export const ownedPhpTransferAddedPaths = [
	"docs/evidence/owned-php-transfers-20260930.md"
	, "src/backends/php/owned-input-transfers.mjs"
	, "tests/fixtures/structured-types/owned-installed-php-transfers.php"
	, "tests/fixtures/structured-types/owned-php-transfers.php"
	, "tests/helpers/owned-php-transfer-evidence.mjs"
	, "tests/helpers/owned-php-transfer-history.mjs"
	, "tests/owned-php-transfer-evidence.test.mjs"
	, "tests/owned-php-transfer-packaging.test.mjs"
	, "tests/owned-php-transfers.test.mjs"
];
export const ownedPhpTransferNormalizationPaths = [...new Set([...ownedPhpTransferChangedPaths, ...ownedPhpWasmTransferChangedPaths])].sort();
let cached;

/**
 * Reverse only authenticated, ordered, non-overlapping edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current identities and recorded edits.
 */
export const reverseOwnedPhpTransferUpdate = (source, update) => {
	assert.ok(ownedPhpTransferChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPhpTransfer = (path, source, expected) => {
	source = beforeOwnedPhpWasmTransfer(path, source, expected);
	if(!ownedPhpTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPhpTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-transfers");
	assert.equal(record.baselineRevision, ownedPhpTransferBaseline);
	assert.deepEqual(record.previous, ownedPhpTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPhpTransferUpdate(source, update) : source;
};

/**
 * Decode only the repair's declared text files.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedPhpTransferHistoricalBytes = (path, bytes, expected) => ownedPhpTransferNormalizationPaths.includes(path)
	? beforeOwnedPhpTransfer(path, bytes.toString("utf8"), expected) : bytes;
