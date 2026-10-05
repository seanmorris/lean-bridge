/**
 * Preserve exact predecessor sources across WIT borrowed-result support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedReceiver, ownedReceiverNormalizationPaths } from "./owned-receiver-history.mjs";

export const ownedWitBorrowPath = "docs/evidence/wit-owned-borrows-20261001.json";
export const ownedWitBorrowBaseline = "3701d0880be3195b249ed17caac6975dea7283f6";
export const ownedWitBorrowPrevious = Object.freeze({
	path: "docs/evidence/owned-javascript-borrows-20261001.json"
	, sha256: "6a42a0d81bf842a579cb7a8c885ea6ee69727e43f2706f07184c5d130e61f211"
});
export const ownedWitBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/wit-wasi.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/wit-wasi.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/owned-package.mjs"
	, "src/backends/wit/owned-graph-model.mjs"
	, "src/backends/wit/owned-host-evidence.mjs"
	, "src/backends/wit/owned-native-host.mjs"
	, "src/backends/wit/owned-native-resources.mjs"
	, "src/backends/wit/owned-package.mjs"
	, "src/backends/wit/owned-session.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-wit-artifacts.mjs"
	, "src/build/owned-wit-projection.mjs"
	, "src/release/owned-wasi.mjs"
	, "tests/helpers/owned-javascript-borrow-history.mjs"
	, "tests/helpers/owned-php-wasm-borrow-history.mjs"
	, "tests/owned-javascript-borrow-evidence.test.mjs"
].sort();
export const ownedWitBorrowAddedPaths = [
	"docs/evidence/wit-owned-borrows-20261001.md"
	, "tests/fixtures/structured-types/owned-wit-borrow-moves.c"
	, "tests/fixtures/structured-types/owned-wit-borrow-only.c"
	, "tests/helpers/wit-owned-borrow-ci.mjs"
	, "tests/helpers/wit-owned-borrow-evidence.mjs"
	, "tests/helpers/wit-owned-borrow-history.mjs"
	, "tests/helpers/wit-owned-borrow-mutants.mjs"
	, "tests/helpers/wit-owned-borrow-probe.mjs"
	, "tests/wit-owned-borrow-evidence.test.mjs"
	, "tests/wit-owned-borrow-packaging.test.mjs"
	, "tests/wit-owned-borrows.test.mjs"
].sort();
let cached;
export const ownedWitBorrowNormalizationPaths = [...new Set([...ownedWitBorrowChangedPaths, ...ownedReceiverNormalizationPaths])].sort();

/**
 * Reverse exact ordered edit spans, checking both complete source identities.
 *
 * @param source - Current complete text.
 * @param update - Authenticated path, source identities and replacement spans.
 */
export const reverseOwnedWitBorrowUpdate = (source, update) => {
	assert.ok(ownedWitBorrowChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedWitBorrow = (path, source, expected) => {
	source = beforeOwnedReceiver(path, source, expected);
	if(!ownedWitBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedWitBorrowPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedWitBorrowBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedWitBorrowPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	const record = cached;
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-borrows");
	assert.equal(record.baselineRevision, ownedWitBorrowBaseline);
	assert.deepEqual(record.previous, ownedWitBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedWitBorrowUpdate(source, update) : source;
};

/**
 * Decode only registered text paths and preserve every unrelated byte.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedWitBorrowHistoricalBytes = (path, bytes, expected) => ownedWitBorrowNormalizationPaths.includes(path)
	? beforeOwnedWitBorrow(path, bytes.toString("utf8"), expected) : bytes;
