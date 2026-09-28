/**
 * Preserve exact predecessor receipts across JavaScript/Wasm ownership.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedJavaScriptNpm, ownedJavaScriptNpmChangedPaths } from "./owned-javascript-npm-source-history.mjs";

export const ownedJavaScriptWasmBaseline = "4c13a5ffdb133cfda841a965e0c858e20300e5ba";
export const ownedJavaScriptWasmHistoryPath = "docs/evidence/owned-javascript-wasm-integration-20260928.json";
export const ownedJavaScriptWasmPrevious = Object.freeze({
	path: "docs/evidence/owned-php-wasm-integration-20260928.json"
	, sha256: "e5314c0da8899ae97b33b11d7aa7d0b0a4a88d7731ae0c66ff1949b059258bc0"
});
export const ownedJavaScriptWasmBaselineSources = Object.freeze({
	"nix/core-source-boundary.json": "c8bd590a7a6c94f9f0f6c78bd066c1d22e1b500c809f46a17d57538b6433de01"
	, "poc/lean-link-spike/component_scalar.cpp": "6a5317ef24233b25014c577b2fa72ef531cc536cd3db23bfe8866f93595b5824"
	, "poc/lean-link-spike/main.c": "0bac0de353ead9b93b03e61390ffedaef28d928b777ae024e5d2795978934bf6"
	, "scripts/build-lean-link-spike.sh": "b1d175a7e4b96de9dc74e05bc4299e4e8057c6b98d7b9b6a1f24f6895dab0e63"
	, "tests/component-runtime.test.mjs": "024374a1920f4ee3ee255e5b6ab88612a8e83f2e91cd738e90f7289bcc6f63c6"
});
export const ownedJavaScriptWasmChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "nix/core-source-boundary.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "poc/lean-link-spike/component_scalar.cpp"
	, "poc/lean-link-spike/main.c"
	, "scripts/build-lean-link-spike.sh"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/javascript/coverage.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/backends/javascript/package-audit.mjs"
	, "src/build/native-component.mjs"
	, "src/release/component-callable-runtime.mjs"
	, "src/release/component-npm-package.mjs"
	, "src/release/component-runtime.mjs"
	, "tests/component-callable-runtime.test.mjs"
	, "tests/component-runtime.test.mjs"
	, "tests/helpers/owned-php-wasm-source-history.mjs"
	, "tests/helpers/php-nix-boundary-repair-history.mjs"
	, "tests/owned-php-wasm-evidence.test.mjs"
].sort();
export const ownedJavaScriptWasmAddedPaths = [
	"docs/evidence/owned-javascript-wasm-values-20260928.md"
	, "scripts/generate-owned-wasm-broker.mjs"
	, "src/abi/component-owned-wasm.mjs"
	, "src/abi/owned-wasm-control.mjs"
	, "src/backends/javascript/owned-package.mjs"
	, "src/backends/javascript/owned-wasm-broker.mjs"
	, "src/backends/javascript/owned-wasm-callbacks.mjs"
	, "src/backends/javascript/owned-wasm-component.mjs"
	, "src/backends/javascript/owned-wasm-layout.mjs"
	, "src/backends/native/callback-broker.mjs"
	, "src/release/owned-wasm-bindings.mjs"
	, "src/release/owned-wasm-callbacks.mjs"
	, "src/release/owned-wasm-calls.mjs"
	, "src/release/owned-wasm-component-runtime.mjs"
	, "src/release/owned-wasm-registry.mjs"
	, "src/release/owned-wasm-scalars.mjs"
	, "src/release/owned-wasm-values.mjs"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/helpers/owned-javascript-wasm-evidence.mjs"
	, "tests/helpers/owned-javascript-wasm-native.mjs"
	, "tests/helpers/owned-javascript-wasm-prepared.mjs"
	, "tests/helpers/owned-javascript-wasm-shared.mjs"
	, "tests/helpers/owned-javascript-wasm-source-history.mjs"
	, "tests/owned-javascript-package.test.mjs"
	, "tests/owned-javascript-wasm-callbacks.test.mjs"
	, "tests/owned-javascript-wasm-ci.test.mjs"
	, "tests/owned-javascript-wasm-component.test.mjs"
	, "tests/owned-javascript-wasm-evidence.test.mjs"
	, "tests/owned-javascript-wasm-layout.test.mjs"
	, "tests/owned-javascript-wasm-loader.test.mjs"
	, "tests/owned-javascript-wasm-native.test.mjs"
	, "tests/owned-javascript-wasm-prepared.test.mjs"
	, "tests/owned-javascript-wasm-shared.test.mjs"
	, "tests/owned-wasm-bindings.test.mjs"
	, "tests/owned-wasm-calls.test.mjs"
	, "tests/owned-wasm-registry.test.mjs"
	, "tests/owned-wasm-scalars.test.mjs"
	, "tests/owned-wasm-values.test.mjs"
].sort();
export const ownedJavaScriptWasmAdditionalSources = [
	"poc/lean-link-spike/Alpha.lean"
	, "poc/lean-link-spike/Beta.lean"
	, "poc/lean-link-spike/alpha_shim.c"
	, "poc/lean-link-spike/beta_shim.c"
	, "poc/lean-link-spike/bindings/alpha.binding-ir.json"
	, "poc/lean-link-spike/bindings/alpha.javascript-projection.json"
	, "poc/lean-link-spike/capsules/alpha.json"
	, "poc/lean-link-spike/capsules/beta.json"
	, "poc/lean-link-spike/capsules/gamma.json"
	, "poc/lean-link-spike/descriptors.mjs"
	, "poc/lean-link-spike/graph-lock.json"
	, "poc/lean-link-spike/private-abi.mjs"
	, "poc/lean-link-spike/runtime_lifecycle.cpp"
	, "poc/link-spike/loader.mjs"
	, "scripts/bootstrap-toolchains.sh"
	, "scripts/build-lean-runtime.sh"
	, "scripts/env.sh"
	, "scripts/lean-runtime-config.sh"
	, "src/analyze/spdx-data.json"
	, "src/backends/php/brick-math.source.json"
	, "src/release/component-copied-codec.mjs"
	, "src/release/component-copied-runtime.mjs"
	, "src/release/source-identity.mjs"
	, "src/runtime/callbacks.mjs"
	, "src/runtime/pending-operations.mjs"
	, "src/runtime/weak-value-map.mjs"
	, "tests/helpers/alias-fixture.mjs"
	, "tests/helpers/array-fixture.mjs"
	, "tests/helpers/c-variant-fixture.mjs"
	, "tests/helpers/callable-fixture.mjs"
	, "tests/helpers/collection-fixture.mjs"
	, "tests/helpers/compound-fixture.mjs"
	, "tests/helpers/compound-source-fixture.mjs"
	, "tests/helpers/dotnet-repeat-observations.mjs"
	, "tests/helpers/dotnet-shared-regressions.mjs"
	, "tests/helpers/jvm-shared-verifier-updates.mjs"
	, "tests/helpers/list-fixture.mjs"
	, "tests/helpers/native-alias-fixture.mjs"
	, "tests/helpers/native-asset-tamper-history.mjs"
	, "tests/helpers/native-asset-tamper.mjs"
	, "tests/helpers/native-variant-fixture.mjs"
	, "tests/helpers/php-callable-fixture.mjs"
	, "tests/helpers/php-graph-conversion-fixture.mjs"
	, "tests/helpers/php-graph-values-fixture.mjs"
	, "tests/helpers/php-variant-fixture.mjs"
	, "tests/helpers/record-fixture.mjs"
	, "tests/helpers/source-registration-upgrade.mjs"
	, "tests/helpers/variant-fixture.mjs"
].sort();
export const ownedJavaScriptWasmNormalizationPaths = [...new Set([...ownedJavaScriptWasmChangedPaths, ...ownedJavaScriptNpmChangedPaths])].sort();
let cached;

/**
 * Reverse only recorded literal edits with matching complete file identities.
 *
 * @param source - Complete current text.
 * @param update - Exact ordered edits and current/predecessor identities.
 */
export const reverseOwnedJavaScriptWasmUpdate = (source, update) => {
	assert.ok(ownedJavaScriptWasmChangedPaths.includes(update.path), update.path);
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
 * Leave unknown edits visible and stop at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or predecessor source text.
 * @param expected - Optional complete identity at which to stop.
 */
export const beforeOwnedJavaScriptWasm = (path, source, expected) => {
	source = beforeOwnedJavaScriptNpm(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !ownedJavaScriptWasmChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedJavaScriptWasmHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-wasm-integration");
	assert.equal(record.baselineRevision, ownedJavaScriptWasmBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptWasmPrevious);
	assert.deepEqual(record.baselineSources, ownedJavaScriptWasmBaselineSources);
	assert.deepEqual(record.updates.map(item => item.path), ownedJavaScriptWasmChangedPaths);
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedJavaScriptWasmUpdate(source, update) : source;
};

/**
 * Normalize declared text paths while retaining unrelated bytes exactly.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current or predecessor bytes.
 * @param expected - Optional complete predecessor identity.
 */
export const ownedJavaScriptWasmHistoricalBytes = (path, bytes, expected) => ownedJavaScriptWasmNormalizationPaths.includes(path)
	? beforeOwnedJavaScriptWasm(path, bytes.toString("utf8"), expected) : bytes;
