/**
 * Preserve authenticated predecessors while adding Perl borrowed-result owners.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedPhpBorrow, ownedPhpBorrowNormalizationPaths } from "./owned-php-borrow-history.mjs";

export const ownedPerlBorrowPath = "docs/evidence/owned-perl-borrows-20261001.json";
export const ownedPerlBorrowBaseline = "85e684e746df8458e48f18ce2962b4a54ea3c989";
export const ownedPerlBorrowPrevious = Object.freeze({
	path: "docs/evidence/managed-whole-close-repair-20260930.json"
	, sha256: "cdffc2c9013bd5b061e995414314f0bb6202ea57d26245b7c96c13d0926bfdb4"
});
export const ownedPerlBorrowChangedPaths = [
	".github/workflows/perl-consumer.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/architecture/binding-ir.md"
	, "docs/consume/perl.md", "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md", "docs/publish/cpan.md"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, "src/backends/perl/Build.pm", "src/backends/perl/owned-conversions.mjs"
	, "src/backends/perl/owned-package.mjs", "src/backends/perl/owned-runtime.mjs"
	, "src/backends/perl/owned-values.mjs", "src/backends/perl/owned-xs.mjs"
	, "src/build/native-project.mjs", "src/build/owned-perl-projection.mjs"
	, "src/release/cpan-package.mjs", "src/release/owned-cpan-contract.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/managed-close-history.mjs"
	, "tests/helpers/owned-perl-native.mjs"
	, "tests/helpers/structured-docs-ci-history.mjs"
	, "tests/managed-close-evidence.test.mjs"
].sort();
export const ownedPerlBorrowAddedPaths = [
	"docs/evidence/owned-perl-borrows-20261001.md"
	, "src/backends/perl/owned-borrows.mjs"
	, "tests/fixtures/structured-types/owned-perl-borrows.pl"
	, "tests/helpers/owned-perl-borrow-evidence.mjs"
	, "tests/helpers/owned-perl-borrow-history.mjs"
	, "tests/owned-perl-borrow-documentation.test.mjs"
	, "tests/owned-perl-borrow-evidence.test.mjs"
	, "tests/owned-perl-borrow-packaging.test.mjs"
	, "tests/owned-perl-borrows.test.mjs"
].sort();
let cached;
export const ownedPerlBorrowNormalizationPaths = [...new Set([...ownedPerlBorrowChangedPaths, ...ownedPhpBorrowNormalizationPaths])].sort();

/**
 * Reverse complete versions using exact ordered edits and both source digests.
 *
 * @param source - Complete current source.
 * @param update - Recorded hashes and replacement spans.
 */
export const reverseOwnedPerlBorrowUpdate = (source, update) => {
	assert.ok(ownedPerlBorrowChangedPaths.includes(update.path), update.path);
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
 * Stop at the requested source identity without hiding unknown modifications.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeOwnedPerlBorrow = (path, source, expected) => {
	source = beforeOwnedPhpBorrow(path, source, expected);
	if(!ownedPerlBorrowChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPerlBorrowPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-perl-borrows");
	assert.equal(record.baselineRevision, ownedPerlBorrowBaseline);
	assert.deepEqual(record.previous, ownedPerlBorrowPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedPerlBorrowChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedPerlBorrowUpdate(source, update) : source;
};

/**
 * Decode only registered text paths and preserve every unrelated byte.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current source bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedPerlBorrowHistoricalBytes = (path, bytes, expected) => ownedPerlBorrowNormalizationPaths.includes(path)
	? beforeOwnedPerlBorrow(path, bytes.toString("utf8"), expected) : bytes;
