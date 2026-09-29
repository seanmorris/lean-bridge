/**
 * Preserve installed receipts across staged native and public C input transfers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedTransferPackage, ownedTransferPackageNormalizationPaths } from "./owned-transfer-package-history.mjs";

export const ownedTransferCBaseline = "5ffbcd067e83927ac45f97b550330c07bd0c0e1f";
export const ownedTransferCPath = "docs/evidence/owned-transfer-c-20260929.json";
export const ownedTransferCPrevious = Object.freeze({
	path: "docs/evidence/wit-owned-build-repair-20260929.json"
	, sha256: "5ead20be6552ef7e27b9c8a42df486840856e4e94c04b33be8417bd3e665eba0"
});
// This existing documentation test enters the source inventory in this stage.
// Its predecessor bytes come from the pinned baseline revision above.
export const ownedTransferCRegisteredSources = Object.freeze({
	"tests/lean-author-documentation.test.mjs": "ae1402b8c07f09434e710f41304cbceda5885a8e419d5032fed95e984392b0a6"
});
export const ownedTransferCChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/architecture/binding-ir.md"
	, "docs/contributing/testing.md", "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "src/adoption/test-profiles.mjs", "src/analyze/NativeExports.lean"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/reviewed-owned-source.mjs", "src/analyze/semantic-model.mjs"
	, "src/backends/c/owned-package.mjs", "src/backends/c/owned-values.mjs"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/backends/native/owned-value-layout.mjs"
	, "src/backends/native/owned-value-runtime.mjs"
	, "tests/helpers/owned-aggregate-native.mjs"
	, "tests/helpers/native-ci-isolation.mjs"
	, "tests/documentation.test.mjs", "tests/lean-author-documentation.test.mjs"
	, "tests/helpers/wit-owned-build-repair-evidence.mjs"
	, "tests/helpers/wit-owned-build-repair-history.mjs"
	, "tests/helpers/wit-owned-package-history.mjs"
	, "tests/reviewed-owned-source.test.mjs"
	, "tests/wit-owned-build-repair-evidence.test.mjs"
].sort();
export const ownedTransferCAddedPaths = [
	"docs/evidence/owned-transfer-c-20260929.md"
	, "src/backends/c/owned-transfers.mjs"
	, "src/backends/native/owned-aggregate-transfers.mjs"
	, "src/backends/native/owned-value-transfers.mjs"
	, "tests/fixtures/structured-types/owned-aggregate-transfers.c"
	, "tests/fixtures/structured-types/owned-public-transfers.c"
	, "tests/helpers/owned-transfer-c-evidence.mjs"
	, "tests/helpers/owned-transfer-c-history.mjs"
	, "tests/helpers/owned-transfer-fixture.mjs"
	, "tests/owned-aggregate-transfers.test.mjs"
	, "tests/owned-c-transfers.test.mjs"
	, "tests/owned-transfer-c-evidence.test.mjs"
].sort();
let cached;
export const ownedTransferCNormalizationPaths = [...new Set([...ownedTransferCChangedPaths, ...ownedTransferPackageNormalizationPaths])].sort();

/**
 * Reverse exact ordered spans after authenticating both complete file versions.
 *
 * @param source - Complete current source text.
 * @param update - Full file hashes and ordered replacement spans.
 */
export const reverseOwnedTransferCUpdate = (source, update) => {
	assert.ok(ownedTransferCChangedPaths.includes(update.path), update.path);
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
 * Preserve unknown edits so previous source-bound receipts reject them.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact historical stopping identity.
 */
export const beforeOwnedTransferC = (path, source, expected) => {
	source = beforeOwnedTransferPackage(path, source, expected);
	if(!ownedTransferCChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedTransferCPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-transfer-c");
	assert.equal(record.baselineRevision, ownedTransferCBaseline);
	assert.deepEqual(record.previous, ownedTransferCPrevious);
	assert.deepEqual(record.registeredSources, ownedTransferCRegisteredSources);
	assert.deepEqual(record.updates.map(update => update.path), ownedTransferCChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedTransferCUpdate(source, update) : source;
};

/**
 * Decode registered text paths only, preserving unrelated binary bytes.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional exact historical stopping identity.
 */
export const ownedTransferCHistoricalBytes = (path, bytes, expected) => ownedTransferCNormalizationPaths.includes(path)
	? beforeOwnedTransferC(path, bytes.toString("utf8"), expected) : bytes;
