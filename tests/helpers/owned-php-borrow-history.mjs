/**
 * Preserve exact prior source receipts across native PHP borrowed-result support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedPhpWasmBorrow, ownedPhpWasmBorrowNormalizationPaths } from "./owned-php-wasm-borrow-history.mjs";

export const ownedPhpBorrowPath = "docs/evidence/owned-php-borrows-20261001.json";
export const ownedPhpBorrowBaseline = "25745d5f3683a3919b40bbc8ce64f6140e615e39";
export const ownedPhpBorrowPrevious = Object.freeze({
	path: "docs/evidence/owned-perl-borrows-20261001.json"
	, sha256: "b5512fdd4da3032b6be1425812d2756a1ae4ae4ffa62c1a731e6bad94296aa76"
});
export const ownedPhpBorrowChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md", "docs/php.md", "docs/publish/php.md"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, "src/backends/php/owned-call-runtime.mjs", "src/backends/php/owned-calls.mjs"
	, "src/backends/php/owned-conversion-support.mjs"
	, "src/backends/php/owned-conversions.mjs"
	, "src/backends/php/owned-package.mjs"
	, "src/backends/php/owned-runtime.mjs", "src/backends/php/owned-value-walk.mjs"
	, "src/backends/php/owned-values.mjs", "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs", "src/build/owned-php-artifacts.mjs"
	, "src/build/owned-php-projection.mjs", "src/release/owned-composer.mjs"
	, "tests/documentation.test.mjs", "tests/helpers/managed-close-history.mjs"
	, "tests/helpers/owned-perl-borrow-history.mjs"
	, "tests/helpers/owned-php-native.mjs"
	, "tests/owned-perl-borrow-evidence.test.mjs"
].sort();
export const ownedPhpBorrowAddedPaths = [
	"docs/evidence/owned-php-borrows-20261001.md"
	, "src/backends/php/owned-borrows.mjs"
	, "tests/fixtures/structured-types/owned-installed-php-borrows.php"
	, "tests/fixtures/structured-types/owned-php-borrows.php"
	, "tests/helpers/owned-php-borrow-evidence.mjs"
	, "tests/helpers/owned-php-borrow-history.mjs"
	, "tests/helpers/owned-php-borrow-mutants.mjs"
	, "tests/owned-php-borrow-documentation.test.mjs"
	, "tests/owned-php-borrow-evidence.test.mjs"
	, "tests/owned-php-borrow-packaging.test.mjs"
	, "tests/owned-php-borrows.test.mjs"
].sort();
let cached;
export const ownedPhpBorrowNormalizationPaths = [...new Set([...ownedPhpBorrowChangedPaths, ...ownedPhpWasmBorrowNormalizationPaths])].sort();

/**
 * Reverse only ordered, authenticated spans of registered source files.
 *
 * @param source - Complete current source.
 * @param update - Exact source identities and ordered replacement spans.
 */
export const reverseOwnedPhpBorrowUpdate = (source, update) => {
	assert.ok(ownedPhpBorrowChangedPaths.includes(update.path), update.path);
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
 * Stop at the requested identity without accepting unknown modifications.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeOwnedPhpBorrow = (path, source, expected) => {
	source = beforeOwnedPhpWasmBorrow(path, source, expected);
	if(!ownedPhpBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedPhpBorrowPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedPhpBorrowBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedPhpBorrowPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	const record = cached;
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-borrows");
	assert.equal(record.baselineRevision, ownedPhpBorrowBaseline);
	assert.deepEqual(record.previous, ownedPhpBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedPhpBorrowUpdate(source, update) : source;
};

/**
 * Decode registered text paths only, preserving every unrelated byte.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete file bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedPhpBorrowHistoricalBytes = (path, bytes, expected) => ownedPhpBorrowNormalizationPaths.includes(path)
	? beforeOwnedPhpBorrow(path, bytes.toString("utf8"), expected) : bytes;
