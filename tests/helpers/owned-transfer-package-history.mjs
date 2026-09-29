/**
 * Preserve prior receipts across compiler-authenticated C transfer packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedTransferPackageBaseline = "27e0eac89682a498537f7a2c5861ac3a53f3b3f1";
export const ownedTransferPackagePath = "docs/evidence/owned-transfer-packages-20260929.json";
export const ownedTransferPackagePrevious = Object.freeze({
	path: "docs/evidence/owned-transfer-c-20260929.json"
	, sha256: "54919340ec217c823f34ed9f5084b6ac54df920dbc275e2652044b5ebeee4c32"
});
export const ownedTransferPackageChangedPaths = [
	".github/workflows/consumer-matrix.yml", "package.json"
	, "docs/architecture/binding-ir.md", "docs/consume/c.md"
	, "docs/contributing/testing.md", "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md", "docs/publish/c.md"
	, "docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
	, "src/analyze/project-analysis.mjs", "src/build/elaborated-component.mjs"
	, "src/build/native-artifacts.mjs", "src/build/native-c-projection.mjs"
	, "src/build/native-component.mjs", "src/build/native-graph-model.mjs"
	, "src/build/native-project.mjs", "src/build/owned-c-projection.mjs"
	, "src/build/owned-native-model.mjs", "src/release/owned-c-package.mjs"
	, "tests/documentation.test.mjs", "tests/lean-author-documentation.test.mjs"
	, "tests/helpers/owned-transfer-c-history.mjs"
	, "tests/helpers/owned-jvm-package-evidence.mjs"
	, "tests/helpers/owned-php-package-evidence.mjs"
	, "tests/helpers/wit-owned-build-repair-history.mjs"
	, "tests/owned-transfer-c-evidence.test.mjs"
].sort();
export const ownedTransferPackageAddedPaths = [
	"docs/evidence/owned-transfer-packages-20260929.md"
	, "tests/fixtures/structured-types/owned-installed-transfers.c"
	, "tests/helpers/owned-transfer-package-evidence.mjs"
	, "tests/helpers/owned-transfer-package-history.mjs"
	, "tests/owned-transfer-analysis.test.mjs"
	, "tests/owned-transfer-package-evidence.test.mjs"
	, "tests/owned-transfer-packaging.test.mjs"
].sort();
let cached;

/**
 * Authenticate both complete file versions before reversing ordered spans.
 *
 * @param source - Complete current source text.
 * @param update - Previous/current hashes and exact ordered replacement spans.
 */
export const reverseOwnedTransferPackageUpdate = (source, update) => {
	assert.ok(ownedTransferPackageChangedPaths.includes(update.path), update.path);
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
 * Leave unknown edits visible to earlier source-bound receipt verifiers.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact historical stopping identity.
 */
export const beforeOwnedTransferPackage = (path, source, expected) => {
	if(!ownedTransferPackageChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedTransferPackagePath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-transfer-packages");
	assert.equal(record.baselineRevision, ownedTransferPackageBaseline);
	assert.deepEqual(record.previous, ownedTransferPackagePrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedTransferPackageChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedTransferPackageUpdate(source, update) : source;
};

/**
 * Preserve unrelated binary bytes without decoding them as text.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional exact historical stopping identity.
 */
export const ownedTransferPackageHistoricalBytes = (path, bytes, expected) => ownedTransferPackageChangedPaths.includes(path)
	? beforeOwnedTransferPackage(path, bytes.toString("utf8"), expected) : bytes;
