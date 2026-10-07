/**
 * Exact source transitions for installed ownership-aware npm delivery.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedJavaScriptCoexistence, ownedJavaScriptCoexistenceNormalizationPaths } from "./owned-javascript-coexistence-source-history.mjs";

export const ownedJavaScriptNpmBaseline = "d265ed3abbe9f1d4d1d9bc290cd7f1e2a9464d5b";
export const ownedJavaScriptNpmHistoryPath = "docs/evidence/owned-javascript-npm-integration-20260928.json";
export const ownedJavaScriptNpmPrevious = Object.freeze({
	path: "docs/evidence/owned-javascript-wasm-integration-20260928.json"
	, sha256: "765ca4846a27003981a25d98a4c692a67fbeff0e375c0b0750196499d9331def"
});
export const ownedJavaScriptNpmBaselineSources = Object.freeze({
	"docs/contributing/author-toolchain.md": "2c98218cf32d272c8446a38b2fed01f456af7c78119af108f4034e51305cf487"
	, "schema/package-set-receipt.schema.json": "e9629aa5475e4ed1653f8963bf8b99105c7e6832938a8c4761e06a2011d7daae"
	, "scripts/build-cli-npm-package.mjs": "740177e49a506556bccc1d9a37ae321a5ef38d8e76451ee499cb9328c739293e"
	, "src/release/cli-npm-package.mjs": "c21939afdfb6249277efbd2f7e4b82ec447d0f515919c325a188658a6fff3de3"
	, "tests/component-char-contract.test.mjs": "0733896f3119d4efe3743847b2623141909208102b0032eb66f9d162c04c4f93"
	, "tests/package-set-receipt.test.mjs": "9fd267e15d8b3198eec6aa34c652a2aa7e0a0197c8ca6e226888f83ec621f31e"
});
export const ownedJavaScriptNpmChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/contributing/author-toolchain.md", "docs/contributing/testing.md"
	, "docs/javascript-typescript.md", "docs/publish/npm.md"
	, "docs/type-surface.v1.json", "package.json"
	, "schema/package-set-receipt.schema.json", "scripts/build-cli-npm-package.mjs"
	, "src/adoption/test-profiles.mjs", "src/build/canonical-build.mjs"
	, "src/build/elaborated-component.mjs", "src/build/multi-profile-project.mjs"
	, "src/release/cli-npm-package.mjs", "src/release/component-npm-package.mjs"
	, "src/release/package-set-receipt.mjs"
	, "tests/component-char-contract.test.mjs"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/helpers/owned-javascript-wasm-source-history.mjs"
	, "tests/helpers/owned-php-wasm-source-history.mjs"
	, "tests/owned-javascript-wasm-ci.test.mjs"
	, "tests/owned-javascript-wasm-evidence.test.mjs"
	, "tests/owned-php-wasm-cli.test.mjs", "tests/package-set-receipt.test.mjs"
].sort();
export const ownedJavaScriptNpmAddedPaths = [
	"docs/evidence/owned-javascript-npm-build-20260928.md"
	, "scripts/build-javascript-wasm-compiler-inputs.mjs"
	, "src/build/javascript-wasm-owned-artifacts.mjs"
	, "src/build/javascript-wasm-owned-component.mjs"
	, "src/build/javascript-wasm-owned-model.mjs"
	, "src/build/javascript-wasm-owned-project.mjs"
	, "src/build/javascript-wasm-owned-sources.mjs"
	, "src/release/javascript-wasm-compiler-inputs.mjs"
	, "src/release/owned-javascript-npm-package.mjs"
	, "tests/helpers/owned-javascript-npm-browser.mjs"
	, "tests/helpers/owned-javascript-npm-evidence.mjs"
	, "tests/helpers/owned-javascript-npm-source-history.mjs"
	, "tests/javascript-wasm-compiler-inputs.test.mjs"
	, "tests/owned-javascript-cli.test.mjs"
	, "tests/owned-javascript-npm-evidence.test.mjs"
	, "tests/owned-javascript-wasm-build.test.mjs"
	, "tests/owned-javascript-wasm-model.test.mjs"
].sort();
export const ownedJavaScriptNpmNormalizationPaths = [...new Set([...ownedJavaScriptNpmChangedPaths, ...ownedJavaScriptCoexistenceNormalizationPaths])].sort();
let cached;

/**
 * Reverse only exact ordered edits with complete predecessor and current hashes.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition for one explicitly listed path.
 */
export const reverseOwnedJavaScriptNpmUpdate = (source, update) => {
	assert.ok(ownedJavaScriptNpmChangedPaths.includes(update.path), update.path);
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
	assert.equal(sha256(restored), update.previousSha256, update.path);
	return restored;
};

/**
 * Preserve unknown edits and stop when the caller requests the current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional identity at which normalization must stop.
 */
export const beforeOwnedJavaScriptNpm = (path, source, expected) => {
	source = beforeOwnedJavaScriptCoexistence(path, source, expected);
	if(typeof source === "string" && !ownedJavaScriptNpmChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedJavaScriptNpmChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedJavaScriptNpmHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-npm-integration");
	assert.equal(record.baselineRevision, ownedJavaScriptNpmBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptNpmPrevious);
	assert.deepEqual(record.baselineSources, ownedJavaScriptNpmBaselineSources);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptNpmChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedJavaScriptNpmUpdate(source, update) : source;
};

/**
 * Decode only declared text transitions; preserve all other bytes exactly.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional predecessor identity.
 */
export const ownedJavaScriptNpmHistoricalBytes = (path, bytes, expected) => ownedJavaScriptNpmNormalizationPaths.includes(path)
	? beforeOwnedJavaScriptNpm(path, bytes.toString("utf8"), expected) : bytes;
