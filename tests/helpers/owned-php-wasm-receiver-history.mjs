/**
 * Authenticate exact source history across PHP-Wasm receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedPhpWasmReceiverPath = "docs/evidence/owned-php-wasm-receivers-20261001.json";
export const ownedPhpWasmReceiverBaseline = "c1725cc2ed8122cf656bfc62446f36069987c53a";
export const ownedPhpWasmReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-receiver-ci-repair-20261001.json"
	, sha256: "78fd69c8361e37746990dc1634632e2bfb5813a43d97b2fe8b5b5d0b1539f03a"
});
export const ownedPhpWasmReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/publish/c.md"
	, "docs/publish/php.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/php/owned-receivers.mjs"
	, "src/backends/php/owned-zend-borrows.mjs"
	, "src/backends/php/owned-zend-callbacks.mjs"
	, "src/backends/php/owned-zend-extension.mjs"
	, "src/backends/php/owned-zend-model.mjs"
	, "src/backends/php/owned-zend-ownership.mjs"
	, "src/backends/php/owned-zend-php.mjs"
	, "src/backends/php/owned-zend-readme.mjs"
	, "src/backends/php/owned-zend-walk.mjs"
	, "src/build/multi-profile-project.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-owned-component.mjs"
	, "src/build/php-wasm-owned-model.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-php-receiver-history.mjs"
	, "tests/helpers/owned-php-receiver-package-evidence.mjs"
	, "tests/helpers/owned-php-wasm-borrow-evidence.mjs"
	, "tests/helpers/owned-php-wasm-borrow-fibers.mjs"
	, "tests/helpers/owned-php-wasm-borrow-mutants.mjs"
	, "tests/helpers/owned-php-wasm-borrows.mjs"
	, "tests/helpers/owned-php-wasm-browser.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/helpers/owned-receiver-ci-repair-history.mjs"
	, "tests/owned-perl-receiver-ci.test.mjs"
].sort();
export const ownedPhpWasmReceiverAddedPaths = [
	"docs/evidence/owned-php-wasm-receivers-20261001.md"
	, "tests/fixtures/structured-types/owned-php-wasm-receivers.php"
	, "tests/helpers/owned-php-wasm-receiver-ci.mjs"
	, "tests/helpers/owned-php-wasm-receiver-evidence.mjs"
	, "tests/helpers/owned-php-wasm-receiver-history.mjs"
	, "tests/owned-php-wasm-receiver-ci.test.mjs"
	, "tests/owned-php-wasm-receiver-documentation.test.mjs"
	, "tests/owned-php-wasm-receiver-evidence.test.mjs"
	, "tests/owned-php-wasm-receiver-model.test.mjs"
	, "tests/owned-php-wasm-receiver-packaging.test.mjs"
	, "tests/owned-php-wasm-receiver-resource-packaging.test.mjs"
	, "tests/owned-php-wasm-receiver-resource.test.mjs"
	, "tests/owned-php-wasm-receivers.test.mjs"
].sort();
let cached;

/**
 * Reverse exact ordered edits after authenticating both complete identities.
 *
 * @param source - Complete current source text.
 * @param update - Path, hashes and reversible replacement spans.
 */
export const reverseOwnedPhpWasmReceiverUpdate = (source, update) => {
	assert.ok(ownedPhpWasmReceiverChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPhpWasmReceiver = (path, source, expected) => {
	if(!ownedPhpWasmReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedPhpWasmReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedPhpWasmReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedPhpWasmReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-php-wasm-receivers");
	assert.equal(cached.baselineRevision, ownedPhpWasmReceiverBaseline);
	assert.deepEqual(cached.previous, ownedPhpWasmReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedPhpWasmReceiverChangedPaths);
	const update = cached.updates.find(value => value.path === path);
	return sha256(source) === update.currentSha256 ? reverseOwnedPhpWasmReceiverUpdate(source, update) : source;
};

/**
 * Decode only registered text paths and retain binary input bytes unchanged.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedPhpWasmReceiverHistoricalBytes = (path, bytes, expected) => ownedPhpWasmReceiverChangedPaths.includes(path)
	? beforeOwnedPhpWasmReceiver(path, bytes.toString("utf8"), expected) : bytes;
