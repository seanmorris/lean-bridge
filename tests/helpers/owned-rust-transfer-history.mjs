/**
 * Authenticate historical sources across installed Rust input transfers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedRustTransferBaseline = "5384a754d1bf356c6b6f3e587d80bb88767dbeb4";
export const ownedRustTransferPath = "docs/evidence/owned-rust-transfers-20260929.json";
export const ownedRustTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-cpp-transfers-20260929.json"
	, sha256: "34bf2c588a390306e517285d12020c10bd442cc46aec57c6507488e01eea4a07"
});
export const ownedRustTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/architecture/binding-ir.md"
	, "docs/consume/rust.md", "docs/contributing/testing.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/publish/cargo.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "src/adoption/test-profiles.mjs", "src/backends/rust/owned-callables.mjs"
	, "src/backends/rust/owned-conversions.mjs"
	, "src/backends/rust/owned-package.mjs"
	, "src/backends/rust/owned-runtime.mjs", "src/backends/rust/owned-values.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "src/build/owned-c-projection.mjs", "src/build/owned-rust-artifacts.mjs"
	, "src/build/owned-rust-projection.mjs", "src/release/owned-cargo.mjs"
	, "tests/documentation.test.mjs", "tests/lean-author-documentation.test.mjs"
	, "tests/helpers/owned-cpp-transfer-history.mjs"
	, "tests/helpers/owned-transfer-package-history.mjs"
	, "tests/owned-cpp-transfer-evidence.test.mjs"
	, "tests/owned-cpp-transfer-packaging.test.mjs"
].sort();
export const ownedRustTransferAddedPaths = [
	"docs/evidence/owned-rust-transfers-20260929.md"
	, "src/backends/rust/owned-transfers.mjs"
	, "tests/fixtures/documentation/consumers/rust/owned-transfers.rs"
	, "tests/fixtures/structured-types/owned-rust-transfers.rs"
	, "tests/helpers/owned-rust-transfer-evidence.mjs"
	, "tests/helpers/owned-rust-transfer-fixture.mjs"
	, "tests/helpers/owned-rust-transfer-history.mjs"
	, "tests/owned-rust-transfer-evidence.test.mjs"
	, "tests/owned-rust-transfer-packaging.test.mjs"
	, "tests/owned-rust-transfers.test.mjs"
].sort();
let cached;

/**
 * Reverse exact ordered edits only after authenticating complete file bytes.
 *
 * @param source - Complete current source text.
 * @param update - Pinned hashes and ordered reversible edits.
 */
export const reverseOwnedRustTransferUpdate = (source, update) => {
	assert.ok(ownedRustTransferChangedPaths.includes(update.path), update.path);
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
 * Keep unrelated or unknown changes visible to historical evidence checks.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional historical stopping digest.
 */
export const beforeOwnedRustTransfer = (path, source, expected) => {
	if(!ownedRustTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedRustTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-rust-transfers");
	assert.equal(record.baselineRevision, ownedRustTransferBaseline);
	assert.deepEqual(record.previous, ownedRustTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedRustTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedRustTransferUpdate(source, update) : source;
};

/**
 * Preserve binary inputs; decode and normalize only registered text paths.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete file bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedRustTransferHistoricalBytes = (path, bytes, expected) => ownedRustTransferChangedPaths.includes(path)
	? beforeOwnedRustTransfer(path, bytes.toString("utf8"), expected) : bytes;
