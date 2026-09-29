/**
 * Authenticate private owned WIT execution without rewriting installed receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedWitSession, ownedWitSessionChangedPaths } from "./wit-owned-session-history.mjs";

export const ownedWitNativeBaseline = "9a2ab9091d501e6d4aac5d668496de2bd6a40579";
export const ownedWitNativePath = "docs/evidence/wit-owned-native-20260929.json";
export const ownedWitNativePrevious = Object.freeze({
	path: "docs/evidence/owned-javascript-nix-20260928.json"
	, sha256: "6092064fec25714aa6f5b1142745fe41aac18e38ae745f9d6fcc6a6bf8c00882"
});
export const ownedWitNativeChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/contributing/testing.md"
	, "docs/type-surface.v1.json", "package.json", "src/adoption/test-profiles.mjs"
	, "tests/helpers/owned-javascript-nix-history.mjs"
	, "tests/helpers/wit-owned-projection-history.mjs"
	, "tests/owned-javascript-nix-evidence.test.mjs"
].sort();
export const ownedWitNativeAddedPaths = [
	"docs/evidence/wit-owned-native-20260929.md"
	, "src/backends/wit/owned-graph-conversions.mjs"
	, "src/backends/wit/owned-graph-runtime.mjs"
	, "src/backends/wit/owned-native-host.mjs"
	, "src/backends/wit/owned-native-resources.mjs"
	, "tests/fixtures/structured-types/wit-owned-conversions.c"
	, "tests/fixtures/structured-types/wit-owned-native-host.c"
	, "tests/helpers/wit-owned-native-evidence.mjs"
	, "tests/helpers/wit-owned-native-history.mjs"
	, "tests/wit-owned-graph-conversions.test.mjs"
	, "tests/wit-owned-native-evidence.test.mjs"
	, "tests/wit-owned-native-host.test.mjs"
].sort();
let cached;
export const ownedWitNativeNormalizationPaths = [...new Set([...ownedWitNativeChangedPaths, ...ownedWitSessionChangedPaths])].sort();

/**
 * Reverse exact ordered spans after authenticating both full file versions.
 *
 * @param source - Complete current source text.
 * @param update - Recorded full hashes and ordered replacement spans.
 */
export const reverseOwnedWitNativeUpdate = (source, update) => {
	assert.ok(ownedWitNativeChangedPaths.includes(update.path), update.path);
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
 * Preserve unknown source edits so predecessor verifiers reject them.
 *
 * @param path - Exact repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact historical stopping identity.
 */
export const beforeOwnedWitNative = (path, source, expected) => {
	source = beforeOwnedWitSession(path, source, expected);
	if(!ownedWitNativeChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedWitNativePath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-native");
	assert.equal(record.baselineRevision, ownedWitNativeBaseline);
	assert.deepEqual(record.previous, ownedWitNativePrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitNativeChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedWitNativeUpdate(source, update) : source;
};

/**
 * Decode registered text paths only, retaining unrelated binary bytes.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional exact historical stopping identity.
 */
export const ownedWitNativeHistoricalBytes = (path, bytes, expected) => ownedWitNativeNormalizationPaths.includes(path)
	? beforeOwnedWitNative(path, bytes.toString("utf8"), expected) : bytes;
