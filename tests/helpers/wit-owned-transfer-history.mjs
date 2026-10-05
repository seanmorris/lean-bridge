/**
 * Preserve preceding receipts across WIT/WASI input-transfer support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedBorrow, ownedBorrowNormalizationPaths } from "./owned-borrow-history.mjs";

export const ownedWitTransferBaseline = "3e28428f0b304f1dfed2cb2ad524b50c1fabdeef";
export const ownedWitTransferPath = "docs/evidence/wit-owned-transfers-20260930.json";
export const ownedWitTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-javascript-transfers-20260930.json"
	, sha256: "9b9ae9c628deb80f145d89aee574e10c1a739e565911d1ba78bd6531b3481d8f"
});
export const ownedWitTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/wit-wasi.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/wit-wasi.md"
	, "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/owned-package.mjs"
	, "src/backends/wit/owned-graph-model.mjs"
	, "src/backends/wit/owned-native-host.mjs"
	, "src/backends/wit/owned-native-resources.mjs"
	, "src/backends/wit/owned-package.mjs"
	, "src/backends/wit/owned-session.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-wit-artifacts.mjs"
	, "src/build/owned-wit-projection.mjs"
	, "src/release/owned-wasi.mjs"
	, "tests/helpers/owned-consumer-ci-repair-evidence.mjs"
	, "tests/helpers/owned-javascript-transfer-history.mjs"
	, "tests/helpers/owned-php-wasm-transfer-history.mjs"
	, "tests/helpers/wit-owned-build-repair-evidence.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/owned-javascript-transfer-evidence.test.mjs"
	, "tests/owned-javascript-nix-installed.test.mjs"
].sort();
export const ownedWitTransferAddedPaths = [
	"docs/evidence/wit-owned-transfers-20260930.md"
	, "tests/fixtures/structured-types/owned-installed-wit-transfer-mixed.c"
	, "tests/fixtures/structured-types/owned-wit-transfer-mixed.c"
	, "tests/helpers/wit-owned-transfer-ci.mjs"
	, "tests/helpers/wit-owned-transfer-evidence.mjs"
	, "tests/helpers/wit-owned-transfer-history.mjs"
	, "tests/helpers/wit-owned-transfer-probe.mjs"
	, "tests/wit-owned-transfer-evidence.test.mjs"
	, "tests/wit-owned-transfer-packaging.test.mjs"
	, "tests/wit-owned-transfers.test.mjs"
];
let cached;
export const ownedWitTransferNormalizationPaths = [...new Set([...ownedWitTransferChangedPaths, ...ownedBorrowNormalizationPaths])].sort();

/**
 * Reverse only authenticated, ordered, non-overlapping edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current identities and recorded edits.
 */
export const reverseOwnedWitTransferUpdate = (source, update) => {
	assert.ok(ownedWitTransferChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedWitTransfer = (path, source, expected) => {
	source = beforeOwnedBorrow(path, source, expected);
	if(!ownedWitTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedWitTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-transfers");
	assert.equal(record.baselineRevision, ownedWitTransferBaseline);
	assert.deepEqual(record.previous, ownedWitTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedWitTransferUpdate(source, update) : source;
};

/**
 * Decode only this milestone's declared text files.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedWitTransferHistoricalBytes = (path, bytes, expected) => ownedWitTransferNormalizationPaths.includes(path)
	? beforeOwnedWitTransfer(path, bytes.toString("utf8"), expected) : bytes;
