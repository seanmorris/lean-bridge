/**
 * Preserve historical package receipts across installed C++ input transfers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedRustTransfer, ownedRustTransferNormalizationPaths } from "./owned-rust-transfer-history.mjs";

export const ownedCppTransferBaseline = "2a0329ae6819dfa3c2387e1bdda628c21df8e62b";
export const ownedCppTransferPath = "docs/evidence/owned-cpp-transfers-20260929.json";
export const ownedCppTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-transfer-packages-20260929.json"
	, sha256: "502f31d2d1cbeed99658d17fcb5a3f1937c25acb7f61fd3978e302bfe4d78b17"
});
export const ownedCppTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/architecture/binding-ir.md"
	, "docs/consume/c.md", "docs/consume/cpp.md", "docs/contributing/testing.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/publish/cpp.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "src/adoption/test-profiles.mjs", "src/backends/cpp/owned-callables.mjs"
	, "src/backends/cpp/owned-conversions.mjs"
	, "src/backends/cpp/owned-package.mjs"
	, "src/backends/cpp/owned-runtime.mjs", "src/backends/cpp/owned-values.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "src/build/owned-c-projection.mjs", "src/release/owned-c-package.mjs"
	, "tests/documentation.test.mjs", "tests/lean-author-documentation.test.mjs"
	, "tests/helpers/owned-transfer-c-history.mjs"
	, "tests/helpers/owned-transfer-package-history.mjs"
	, "tests/owned-transfer-package-evidence.test.mjs"
	, "tests/owned-transfer-packaging.test.mjs"
].sort();
export const ownedCppTransferAddedPaths = [
	"docs/evidence/owned-cpp-transfers-20260929.md"
	, "src/backends/cpp/owned-transfers.mjs"
	, "tests/fixtures/documentation/consumers/cpp/owned-transfers.cpp"
	, "tests/fixtures/structured-types/owned-cpp-transfers.cpp"
	, "tests/helpers/owned-cpp-transfer-evidence.mjs"
	, "tests/helpers/owned-cpp-transfer-history.mjs"
	, "tests/owned-cpp-transfer-evidence.test.mjs"
	, "tests/owned-cpp-transfer-packaging.test.mjs"
	, "tests/owned-cpp-transfers.test.mjs"
].sort();
let cached;
export const ownedCppTransferNormalizationPaths = [...new Set([...ownedCppTransferChangedPaths, ...ownedRustTransferNormalizationPaths])].sort();

/**
 * Authenticate complete file versions before reversing exact ordered edits.
 *
 * @param source - Complete current source text.
 * @param update - Previous/current hashes and ordered replacement spans.
 */
export const reverseOwnedCppTransferUpdate = (source, update) => {
	assert.ok(ownedCppTransferChangedPaths.includes(update.path), update.path);
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
 * Keep unknown changes visible to all previous source-bound verifiers.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact historical stopping identity.
 */
export const beforeOwnedCppTransfer = (path, source, expected) => {
	source = beforeOwnedRustTransfer(path, source, expected);
	if(!ownedCppTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedCppTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-cpp-transfers");
	assert.equal(record.baselineRevision, ownedCppTransferBaseline);
	assert.deepEqual(record.previous, ownedCppTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedCppTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedCppTransferUpdate(source, update) : source;
};

/**
 * Decode registered text paths only; preserve unrelated binary bytes.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional exact historical stopping identity.
 */
export const ownedCppTransferHistoricalBytes = (path, bytes, expected) => ownedCppTransferNormalizationPaths.includes(path)
	? beforeOwnedCppTransfer(path, bytes.toString("utf8"), expected) : bytes;
