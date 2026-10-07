/**
 * Preserve frozen source receipts across native PHP ownership integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedWasm32, ownedWasm32NormalizationPaths } from "./owned-wasm32-source-history.mjs";

export const ownedPhpBaseline = "629557e8179e9e91ba2ecb3fe75a8dcac107c6ce";
export const ownedPhpHistoryPath = "docs/evidence/owned-php-integration-20260928.json";
export const ownedPhpPrevious = Object.freeze({
	path: "docs/evidence/perl-contract-repair-20260928.json"
	, sha256: "3080c11c182d463b0214b70caea18b5e35aef5f3d8f219cf545dd3b7b0001624"
});
export const ownedPhpChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-perl-source-history.mjs"
	, "tests/helpers/perl-contract-repair-history.mjs"
	, "tests/owned-c-packaging.test.mjs"
	, "tests/perl-contract-repair-evidence.test.mjs"
];
export const ownedPhpAddedPaths = [
	"docs/evidence/owned-php-bootstrap-20260928.md"
	, "docs/evidence/owned-php-calls-20260928.md"
	, "docs/evidence/owned-php-conversions-20260928.md"
	, "docs/evidence/owned-php-integration-20260928.md"
	, "docs/evidence/owned-php-packages-20260928.md"
	, "docs/evidence/owned-php-runtime-20260928.md"
	, "docs/evidence/owned-php-values-20260928.md"
	, "src/backends/php/owned-assets.mjs"
	, "src/backends/php/owned-call-runtime.mjs"
	, "src/backends/php/owned-calls.mjs"
	, "src/backends/php/owned-conversion-support.mjs"
	, "src/backends/php/owned-conversion-transfer.mjs"
	, "src/backends/php/owned-conversions.mjs"
	, "src/backends/php/owned-integers.mjs"
	, "src/backends/php/owned-package.mjs"
	, "src/backends/php/owned-runtime.mjs"
	, "src/backends/php/owned-value-resources.mjs"
	, "src/backends/php/owned-value-walk.mjs"
	, "src/backends/php/owned-values.mjs"
	, "src/build/owned-php-artifacts.mjs"
	, "src/build/owned-php-projection.mjs"
	, "src/release/owned-composer.mjs"
	, "tests/fixtures/structured-types/owned-installed-php-loader.php"
	, "tests/fixtures/structured-types/owned-installed-php.php"
	, "tests/fixtures/structured-types/owned-php-calls-probe.php"
	, "tests/fixtures/structured-types/owned-php-calls-retirement.php"
	, "tests/fixtures/structured-types/owned-php-calls.php"
	, "tests/fixtures/structured-types/owned-php-coexistence.php"
	, "tests/fixtures/structured-types/owned-php-conversion-probe.php"
	, "tests/fixtures/structured-types/owned-php-conversions.php"
	, "tests/fixtures/structured-types/owned-php-runtime.php"
	, "tests/fixtures/structured-types/owned-php-values.php"
	, "tests/helpers/owned-php-ci.mjs"
	, "tests/helpers/owned-php-installed.mjs"
	, "tests/helpers/owned-php-native.mjs"
	, "tests/helpers/owned-php-package-evidence.mjs"
	, "tests/helpers/owned-php-source-history.mjs"
	, "tests/owned-php-calls.test.mjs"
	, "tests/owned-php-ci.test.mjs"
	, "tests/owned-php-coexistence.test.mjs"
	, "tests/owned-php-conversions.test.mjs"
	, "tests/owned-php-documentation.test.mjs"
	, "tests/owned-php-package-evidence.test.mjs"
	, "tests/owned-php-package.test.mjs"
	, "tests/owned-php-packaging.test.mjs"
	, "tests/owned-php-runtime.test.mjs"
	, "tests/owned-php-values.test.mjs"
];
export const ownedPhpNormalizationPaths = [...new Set([...ownedPhpChangedPaths, ...ownedWasm32NormalizationPaths])].sort();
let cached;

/**
 * Reverse only literal edits authenticated by both complete source identities.
 *
 * @param source - Complete current source text.
 * @param update - Exact current/predecessor identities and ordered edits.
 */
export const reverseOwnedPhpUpdate = (source, update) => {
	assert.ok(ownedPhpChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const pieces = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current, update.path);
		pieces.push(source.slice(end, start), previous); end = start + current.length;
	}
	pieces.push(source.slice(end)); const restored = pieces.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path);
	return restored;
};

/**
 * Restore a known predecessor and leave every unrecorded edit visible.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact identity at which to stop.
 */
export const beforeOwnedPhpPackages = (path, source, expected) => {
	source = beforeOwnedWasm32(path, source, expected);
	if(typeof source === "string" && !ownedPhpChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedPhpChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPhpHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "owned-php-package-integration");
	assert.equal(record.baselineRevision, ownedPhpBaseline);
	assert.deepEqual(record.previous, ownedPhpPrevious);
	assert.deepEqual(record.updates.map(item => item.path), ownedPhpChangedPaths);
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPhpUpdate(source, update) : source;
};

/**
 * Normalize only declared text files, preserving unrelated binary bytes.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Optional exact identity.
 */
export const ownedPhpHistoricalBytes = (path, bytes, expected) => ownedPhpNormalizationPaths.includes(path)
	? beforeOwnedPhpPackages(path, bytes.toString("utf8"), expected) : bytes;
