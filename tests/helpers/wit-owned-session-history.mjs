/**
 * Authenticate public owned WIT sessions without rewriting installed receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedWitPackage, ownedWitPackageChangedPaths } from "./wit-owned-package-history.mjs";

export const ownedWitSessionBaseline = "f2038781354eb853fefdd58de3995c996d6f7e22";
export const ownedWitSessionPath = "docs/evidence/wit-owned-session-20260929.json";
export const ownedWitSessionPrevious = Object.freeze({
	path: "docs/evidence/wit-owned-native-20260929.json"
	, sha256: "21a6c02cfe72e0005db68597fa599d98de3e78c03a43f962efcfd867bae15f26"
});
export const ownedWitSessionChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/owned-package.mjs"
	, "src/backends/c/owned-runtime.mjs"
	, "src/backends/c/owned-values.mjs"
	, "src/backends/wit/owned-graph-runtime.mjs"
	, "src/backends/wit/owned-native-host.mjs"
	, "src/backends/wit/owned-native-resources.mjs"
	, "tests/helpers/owned-javascript-nix-history.mjs"
	, "tests/helpers/wit-owned-native-history.mjs"
	, "tests/wit-owned-native-evidence.test.mjs"
].sort();
export const ownedWitSessionAddedPaths = [
	"docs/evidence/wit-owned-session-20260929.md"
	, "src/backends/wit/owned-package.mjs"
	, "src/backends/wit/owned-session.mjs"
	, "tests/helpers/wit-owned-session-evidence.mjs"
	, "tests/helpers/wit-owned-session-history.mjs"
	, "tests/wit-owned-session-evidence.test.mjs"
	, "tests/wit-owned-session.test.mjs"
].sort();
let cached;
export const ownedWitSessionNormalizationPaths = [...new Set([...ownedWitSessionChangedPaths, ...ownedWitPackageChangedPaths])].sort();

/**
 * Reverse exact ordered spans after authenticating both full file versions.
 *
 * @param source - Complete current source text.
 * @param update - Recorded full hashes and ordered replacement spans.
 */
export const reverseOwnedWitSessionUpdate = (source, update) => {
	assert.ok(ownedWitSessionChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedWitSession = (path, source, expected) => {
	source = beforeOwnedWitPackage(path, source, expected);
	if(!ownedWitSessionChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedWitSessionPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-session");
	assert.equal(record.baselineRevision, ownedWitSessionBaseline);
	assert.deepEqual(record.previous, ownedWitSessionPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitSessionChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedWitSessionUpdate(source, update) : source;
};

/**
 * Decode registered text paths only, retaining unrelated binary bytes.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional exact historical stopping identity.
 */
export const ownedWitSessionHistoricalBytes = (path, bytes, expected) => ownedWitSessionNormalizationPaths.includes(path)
	? beforeOwnedWitSession(path, bytes.toString("utf8"), expected) : bytes;
