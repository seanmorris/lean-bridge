/**
 * Authenticate exact source history across JavaScript receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedWitReceiver, ownedWitReceiverNormalizationPaths } from "./wit-owned-receiver-history.mjs";

export const ownedJavaScriptReceiverPath = "docs/evidence/owned-javascript-receivers-20261001.json";
export const ownedJavaScriptReceiverBaseline = "a56a39a7e959067643b545800b7d5e95082beafd";
export const ownedJavaScriptReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-php-wasm-receivers-20261001.json"
	, sha256: "9137b90fbccfd3d9741a88ed053edcf861835f567a27c22b0541b6ed39a05ef3"
});
export const ownedJavaScriptReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/contributing/testing.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/npm.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/abi/component-owned-wasm.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/javascript/owned-package.mjs"
	, "src/backends/javascript/owned-wasm-component.mjs"
	, "src/backends/javascript/owned-wasm-layout.mjs"
	, "src/build/javascript-wasm-owned-artifacts.mjs"
	, "src/build/javascript-wasm-owned-component.mjs"
	, "src/build/javascript-wasm-owned-model.mjs"
	, "src/build/javascript-wasm-owned-sources.mjs"
	, "src/release/component-runtime.mjs"
	, "src/release/owned-wasm-borrow-registry.mjs"
	, "src/release/owned-wasm-calls.mjs"
	, "tests/helpers/owned-javascript-borrow-evidence.mjs"
	, "tests/helpers/owned-javascript-wasm-native.mjs"
	, "tests/helpers/owned-php-wasm-ci.mjs"
	, "tests/helpers/owned-php-wasm-receiver-history.mjs"
	, "tests/helpers/owned-receiver-ci-repair-history.mjs"
	, "tests/owned-php-wasm-ci.test.mjs"
	, "tests/owned-php-wasm-receiver-evidence.test.mjs"
	, "tests/owned-php-zend-extension.test.mjs"
].sort();
export const ownedJavaScriptReceiverAddedPaths = [
	"docs/evidence/owned-javascript-receivers-20261001.md"
	, "tests/fixtures/structured-types/owned-installed-javascript-receivers.mjs"
	, "tests/fixtures/structured-types/owned-installed-javascript-resource-receivers.mjs"
	, "tests/fixtures/structured-types/owned-javascript-receiver-semantic.mjs"
	, "tests/helpers/owned-javascript-receiver-ci.mjs"
	, "tests/helpers/owned-javascript-receiver-configurations.mjs"
	, "tests/helpers/owned-javascript-receiver-evidence.mjs"
	, "tests/helpers/owned-javascript-receiver-faults.mjs"
	, "tests/helpers/owned-javascript-receiver-history.mjs"
	, "tests/helpers/owned-javascript-receiver-inventory.mjs"
	, "tests/helpers/owned-javascript-receiver-mutants.mjs"
	, "tests/owned-javascript-receiver-ci.test.mjs"
	, "tests/owned-javascript-receiver-coexistence.test.mjs"
	, "tests/owned-javascript-receiver-evidence.test.mjs"
	, "tests/owned-javascript-receiver-gc.test.mjs"
	, "tests/owned-javascript-receiver-model.test.mjs"
	, "tests/owned-javascript-receiver-mutants.test.mjs"
	, "tests/owned-javascript-receiver-package.test.mjs"
	, "tests/owned-javascript-receiver-packaging.test.mjs"
	, "tests/owned-javascript-receiver-resource-packaging.test.mjs"
	, "tests/owned-javascript-receiver-unanchored.test.mjs"
	, "tests/owned-javascript-receivers.test.mjs"
].sort();
let cached;
export const ownedJavaScriptReceiverNormalizationPaths = [...new Set([...ownedJavaScriptReceiverChangedPaths, ...ownedWitReceiverNormalizationPaths])].sort();

/**
 * Reverse exact ordered edits after authenticating both complete identities.
 *
 * @param source - Complete current source text.
 * @param update - Path, hashes and reversible replacement spans.
 */
export const reverseOwnedJavaScriptReceiverUpdate = (source, update) => {
	assert.ok(ownedJavaScriptReceiverChangedPaths.includes(update.path), update.path);
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
	parts.push(source.slice(end)); const prior = parts.join("");
	assert.equal(sha256(prior), update.previousSha256, update.path); return prior;
};

/**
 * Preserve unknown changes and stop at a requested historical digest.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional stopping digest.
 */
export const beforeOwnedJavaScriptReceiver = (path, source, expected) => {
	source = beforeOwnedWitReceiver(path, source, expected);
	if(!ownedJavaScriptReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedJavaScriptReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedJavaScriptReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedJavaScriptReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-javascript-receivers");
	assert.equal(cached.baselineRevision, ownedJavaScriptReceiverBaseline);
	assert.deepEqual(cached.previous, ownedJavaScriptReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedJavaScriptReceiverChangedPaths);
	const update = cached.updates.find(value => value.path === path);
	return sha256(source) === update.currentSha256 ? reverseOwnedJavaScriptReceiverUpdate(source, update) : source;
};

/**
 * Decode only registered text paths and retain binary input bytes unchanged.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedJavaScriptReceiverHistoricalBytes = (path, bytes, expected) => ownedJavaScriptReceiverNormalizationPaths.includes(path)
	? beforeOwnedJavaScriptReceiver(path, bytes.toString("utf8"), expected) : bytes;
