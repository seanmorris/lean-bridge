/**
 * Authenticate exact predecessor sources across Rust receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedPythonReceiver, ownedPythonReceiverNormalizationPaths } from "./owned-python-receiver-history.mjs";

export const ownedRustReceiverPath = "docs/evidence/owned-rust-receivers-20261001.json";
export const ownedRustReceiverBaseline = "39caf918fbbb49658026fc27572db1decdbd24a3";
export const ownedRustReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-cpp-receivers-20261001.json"
	, sha256: "de327eafe67ce73c02a6023db30f4d9ef2e0516cf4ded3fda72ad4b456ade7db"
});
export const ownedRustReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/rust.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/cargo.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/rust/owned-borrows.mjs"
	, "src/backends/rust/owned-callables.mjs"
	, "src/backends/rust/owned-conversions.mjs"
	, "src/backends/rust/owned-package.mjs"
	, "src/backends/rust/owned-runtime.mjs"
	, "src/backends/rust/owned-values.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-c-projection.mjs"
	, "src/build/owned-rust-artifacts.mjs"
	, "src/build/owned-rust-projection.mjs"
	, "src/release/owned-cargo.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-cpp-receiver-evidence.mjs"
	, "tests/helpers/owned-cpp-receiver-history.mjs"
	, "tests/helpers/owned-receiver-history.mjs"
	, "tests/owned-cpp-receiver-evidence.test.mjs"
].sort();
export const ownedRustReceiverAddedPaths = [
	"docs/evidence/owned-rust-receivers-20261001.md"
	, "tests/fixtures/documentation/consumers/rust/owned-receivers.rs"
	, "tests/fixtures/structured-types/owned-rust-receivers.rs"
	, "tests/helpers/owned-rust-receiver-ci.mjs"
	, "tests/helpers/owned-rust-receiver-evidence.mjs"
	, "tests/helpers/owned-rust-receiver-fixture.mjs"
	, "tests/helpers/owned-rust-receiver-history.mjs"
	, "tests/owned-rust-receiver-contract.test.mjs"
	, "tests/owned-rust-receiver-evidence.test.mjs"
	, "tests/owned-rust-receiver-packaging.test.mjs"
	, "tests/owned-rust-receiver-plain.test.mjs"
	, "tests/owned-rust-receivers.test.mjs"
].sort();
let cached;
export const ownedRustReceiverNormalizationPaths = [...new Set([...ownedRustReceiverChangedPaths, ...ownedPythonReceiverNormalizationPaths])].sort();

/**
 * Reverse registered edit spans after checking both complete source identities.
 *
 * @param source - Complete current text.
 * @param update - Authenticated path, identities and replacement spans.
 */
export const reverseOwnedRustReceiverUpdate = (source, update) => {
	assert.ok(ownedRustReceiverChangedPaths.includes(update.path), update.path);
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
 * Stop at requested identities and never conceal unrecorded changes.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping identity.
 */
export const beforeOwnedRustReceiver = (path, source, expected) => {
	source = beforeOwnedPythonReceiver(path, source, expected);
	if(!ownedRustReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedRustReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedRustReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedRustReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-rust-receivers");
	assert.equal(cached.baselineRevision, ownedRustReceiverBaseline);
	assert.deepEqual(cached.previous, ownedRustReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedRustReceiverChangedPaths);
	const update = cached.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedRustReceiverUpdate(source, update) : source;
};

/**
 * Preserve binary inputs and decode only the registered text paths.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedRustReceiverHistoricalBytes = (path, bytes, expected) => ownedRustReceiverNormalizationPaths.includes(path)
	? beforeOwnedRustReceiver(path, bytes.toString("utf8"), expected) : bytes;
