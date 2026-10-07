/**
 * Preserve earlier WIT receipts while authenticating installed owned packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedWitBuildRepair, ownedWitBuildRepairNormalizationPaths } from "./wit-owned-build-repair-history.mjs";

export const ownedWitPackageBaseline = "2ae8ff5cb06fc2b56adc20aa33b10a170b81d3f1";
export const ownedWitPackagePath = "docs/evidence/wit-owned-packages-20260929.json";
export const ownedWitPackagePrevious = Object.freeze({
	path: "docs/evidence/wit-owned-session-20260929.json"
	, sha256: "4877d78afec761f4be75ac613a6139619c133ce1976e7741e9de2c19072d39b9"
});
export const ownedWitPackageChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/consume/wit-wasi.md"
	, "docs/contributing/testing.md", "docs/publish/wit-wasi.md"
	, "docs/type-surface.v1.json", "package.json", "src/adoption/test-profiles.mjs"
	, "src/backends/wit/host-evidence.mjs", "src/build/canonical-build.mjs"
	, "src/build/multi-profile-project.mjs", "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs", "tests/owned-c-packaging.test.mjs"
	, "tests/helpers/wit-owned-native-history.mjs"
	, "tests/helpers/wit-owned-session-history.mjs"
	, "tests/wit-owned-session-evidence.test.mjs"
].sort();
export const ownedWitPackageAddedPaths = [
	"docs/evidence/wit-owned-packages-20260929.md"
	, "src/backends/wit/owned-host-evidence.mjs"
	, "src/build/owned-wit-artifacts.mjs", "src/build/owned-wit-projection.mjs"
	, "src/release/owned-wasi.mjs"
	, "tests/fixtures/structured-types/owned-installed-scalars.c"
	, "tests/fixtures/structured-types/wit-owned-package-loader.c"
	, "tests/helpers/wit-owned-package-evidence.mjs"
	, "tests/helpers/wit-owned-package-history.mjs"
	, "tests/helpers/wit-owned-package-loader.mjs"
	, "tests/wit-owned-host-evidence.test.mjs"
	, "tests/wit-owned-package-evidence.test.mjs"
	, "tests/wit-owned-packaging.test.mjs"
].sort();
let cached;
export const ownedWitPackageNormalizationPaths = [...new Set([...ownedWitPackageChangedPaths, ...ownedWitBuildRepairNormalizationPaths])].sort();

/**
 * Reverse exact ordered spans after authenticating both complete file versions.
 *
 * @param source - Complete current source text.
 * @param update - Recorded full hashes and ordered replacement spans.
 */
export const reverseOwnedWitPackageUpdate = (source, update) => {
	assert.ok(ownedWitPackageChangedPaths.includes(update.path), update.path);
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
 * Preserve unknown edits so older source-bound receipts continue to reject them.
 *
 * @param path - Exact repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact historical stopping identity.
 */
export const beforeOwnedWitPackage = (path, source, expected) => {
	source = beforeOwnedWitBuildRepair(path, source, expected);
	if(!ownedWitPackageChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedWitPackagePath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-packages");
	assert.equal(record.baselineRevision, ownedWitPackageBaseline);
	assert.deepEqual(record.previous, ownedWitPackagePrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitPackageChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedWitPackageUpdate(source, update) : source;
};

/**
 * Decode registered text paths only, retaining unrelated binary bytes.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional exact historical stopping identity.
 */
export const ownedWitPackageHistoricalBytes = (path, bytes, expected) => ownedWitPackageNormalizationPaths.includes(path)
	? beforeOwnedWitPackage(path, bytes.toString("utf8"), expected) : bytes;
