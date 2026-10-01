/**
 * Authenticate exact predecessor sources across C++ receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedRustReceiver, ownedRustReceiverChangedPaths } from "./owned-rust-receiver-history.mjs";

export const ownedCppReceiverPath = "docs/evidence/owned-cpp-receivers-20261001.json";
export const ownedCppReceiverBaseline = "a514c3516343740ea8b3ef9335fb82f2251b3435";
export const ownedCppReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-receivers-20261001.json"
	, sha256: "16ca503975c8f14a17f08e2346d71a7cba6a07250cb8a8fd765b96f2f20a1353"
});
export const ownedCppReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/cpp.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/cpp.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/cpp/owned-borrows.mjs"
	, "src/backends/cpp/owned-callables.mjs"
	, "src/backends/cpp/owned-conversions.mjs"
	, "src/backends/cpp/owned-package.mjs"
	, "src/backends/cpp/owned-runtime.mjs"
	, "src/backends/cpp/owned-values.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-c-projection.mjs"
	, "src/release/owned-c-package.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-receiver-evidence.mjs"
	, "tests/helpers/owned-receiver-history.mjs"
	, "tests/helpers/wit-owned-borrow-history.mjs"
	, "tests/owned-receiver-evidence.test.mjs"
].sort();
export const ownedCppReceiverAddedPaths = [
	"docs/evidence/owned-cpp-receivers-20261001.md"
	, "tests/fixtures/structured-types/owned-cpp-receivers.cpp"
	, "tests/helpers/owned-cpp-receiver-ci.mjs"
	, "tests/helpers/owned-cpp-receiver-evidence.mjs"
	, "tests/helpers/owned-cpp-receiver-fixture.mjs"
	, "tests/helpers/owned-cpp-receiver-history.mjs"
	, "tests/owned-cpp-receiver-contract.test.mjs"
	, "tests/owned-cpp-receiver-evidence.test.mjs"
	, "tests/owned-cpp-receiver-packaging.test.mjs"
	, "tests/owned-cpp-receiver-plain.test.mjs"
	, "tests/owned-cpp-receivers.test.mjs"
].sort();
let cached;
export const ownedCppReceiverNormalizationPaths = [...new Set([...ownedCppReceiverChangedPaths, ...ownedRustReceiverChangedPaths])].sort();

/**
 * Reverse registered edit spans after checking both complete source identities.
 *
 * @param source - Complete current text.
 * @param update - Authenticated path, identities and replacement spans.
 */
export const reverseOwnedCppReceiverUpdate = (source, update) => {
	assert.ok(ownedCppReceiverChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedCppReceiver = (path, source, expected) => {
	source = beforeOwnedRustReceiver(path, source, expected);
	if(!ownedCppReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedCppReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedCppReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedCppReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-cpp-receivers");
	assert.equal(cached.baselineRevision, ownedCppReceiverBaseline);
	assert.deepEqual(cached.previous, ownedCppReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedCppReceiverChangedPaths);
	const update = cached.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedCppReceiverUpdate(source, update) : source;
};

/**
 * Preserve binary inputs and decode only the registered text paths.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedCppReceiverHistoricalBytes = (path, bytes, expected) => ownedCppReceiverNormalizationPaths.includes(path)
	? beforeOwnedCppReceiver(path, bytes.toString("utf8"), expected) : bytes;
