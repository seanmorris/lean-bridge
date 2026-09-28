/**
 * Preserve exact predecessor evidence across the owned npm engine integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedJavaScriptEngineBaseline = "2494d70ddb05f85245133c1ce5c7610dba918a8d";
export const ownedJavaScriptEngineHistoryPath = "docs/evidence/owned-javascript-engine-integration-20260928.json";
export const ownedJavaScriptEnginePrevious = Object.freeze({
	path: "docs/evidence/owned-zend-bailout-repair-20260928.json"
	, sha256: "544402237c8bf8e79d78ffb35814f3d7ed68d154ed8b180155b39116fcb0a4da"
});
export const ownedJavaScriptEngineBaselineSources = Object.freeze({
	"flake.nix": "311424c2935a945bf522672d88d0977792ac6d6605718adfe70c406f948594fd"
	, "nix/wasm-toolchain.nix": "5095b1e87cda3b256cd9c66f741577d328bdb88f6e287b2ec86ef2588c91f3e4"
	, "schema/engine-execution-request.schema.json": "4f637f1007d9d876593250ce5cdb0374f990e28f566e40612d617a290c47805b"
	, "scripts/run-component-engine.mjs": "a4fe77a9a9ee18e498d03d034f46aced139b0047216a464d412dcab4f9cfc567"
	, "src/build/component-engine.mjs": "4f01f6f604c75a1bee7a833143f0ea8aebb2c31aaf8ecd7f451c9f4deda242fa"
	, "tests/internal/abi/lean-pending-operation.test.mjs": "2371a853237f23456665ba4b384a56e00e13c71f55a0539eb49306475f2a4ad3"
});
export const ownedJavaScriptEngineChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/contributing/testing.md", "docs/publish/npm.md"
	, "docs/type-surface.v1.json"
	, "flake.nix", "nix/component-engine-source-boundary.json"
	, "nix/core-source-boundary.json", "nix/wasm-toolchain.nix"
	, "package.json"
	, "poc/lean-link-spike/main.c"
	, "schema/engine-execution-request.schema.json"
	, "schema/lake-entry-intent.schema.json"
	, "scripts/run-component-engine.mjs", "src/adoption/test-profiles.mjs"
	, "src/build/component-engine.mjs", "src/build/elaborated-component.mjs"
	, "src/build/engine-execution-request.mjs"
	, "src/build/javascript-wasm-owned-artifacts.mjs"
	, "src/build/javascript-wasm-owned-component.mjs"
	, "src/build/javascript-wasm-owned-project.mjs"
	, "src/build/lake-entry-intent.mjs"
	, "tests/helpers/owned-analysis-source-history.mjs"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/helpers/owned-zend-bailout-repair-history.mjs"
	, "tests/internal/abi/lean-pending-operation.test.mjs"
	, "tests/managed-ci-isolation.test.mjs", "tests/owned-javascript-cli.test.mjs"
	, "tests/owned-javascript-wasm-ci.test.mjs"
	, "tests/owned-javascript-wasm-shared.test.mjs"
	, "tests/owned-zend-bailout-repair.test.mjs"
].sort();
export const ownedJavaScriptEngineAddedPaths = [
	"docs/evidence/owned-javascript-engine-integration-20260928.md"
	, "src/build/javascript-wasm-owned-engine.mjs"
	, "src/build/javascript-wasm-owned-isolated.mjs"
	, "src/build/javascript-wasm-owned-output.mjs"
	, "src/build/javascript-wasm-toolchain.mjs"
	, "tests/helpers/owned-javascript-engine-evidence.mjs"
	, "tests/helpers/owned-javascript-engine-history.mjs"
	, "tests/javascript-wasm-toolchain.test.mjs"
	, "tests/owned-javascript-archive-sdk.test.mjs"
	, "tests/owned-javascript-engine-evidence.test.mjs"
	, "tests/owned-javascript-engine-request.test.mjs"
	, "tests/owned-javascript-engine.test.mjs"
	, "tests/owned-javascript-isolated-project.test.mjs"
].sort();
let cached;

/**
 * Undo only ordered literal edits authenticated by both complete source hashes.
 *
 * @param source - Complete current source text.
 * @param update - Closed path, source identities and literal edits.
 */
export const reverseOwnedJavaScriptEngineUpdate = (source, update) => {
	assert.ok(ownedJavaScriptEngineChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const parts = []; let end = 0;
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
 * Restore a declared predecessor while keeping all unrecorded changes visible.
 *
 * @param path - Exact repository-relative path.
 * @param source - Complete current or historical text.
 * @param expected - Optional stopping source identity.
 */
export const beforeOwnedJavaScriptEngine = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !ownedJavaScriptEngineChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedJavaScriptEngineHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-engine-integration");
	assert.equal(record.baselineRevision, ownedJavaScriptEngineBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptEnginePrevious);
	assert.deepEqual(record.baselineSources, ownedJavaScriptEngineBaselineSources);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptEngineChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedJavaScriptEngineUpdate(source, update) : source;
};

/**
 * Decode only exact registered text paths and preserve unrelated binary bytes.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedJavaScriptEngineHistoricalBytes = (path, bytes, expected) => ownedJavaScriptEngineChangedPaths.includes(path)
	? beforeOwnedJavaScriptEngine(path, bytes.toString("utf8"), expected) : bytes;
