/**
 * Preserve exact predecessor receipts across public PHP-Wasm ownership.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedJavaScriptWasm, ownedJavaScriptWasmChangedPaths } from "./owned-javascript-wasm-source-history.mjs";

export const ownedPhpWasmBaseline = "560dac4edb67c5b7cdd8bb945b684c1f2eb64f53";
export const ownedPhpWasmHistoryPath = "docs/evidence/owned-php-wasm-integration-20260928.json";
export const ownedPhpWasmPrevious = Object.freeze({
	path: "docs/evidence/php-nix-boundary-repair-20260928.json"
	, sha256: "1e1d1d02c5233214b1b968b47b09cf5e8f953a7fd4a911f64b49ec5144b53c4b"
});
export const ownedPhpWasmBaselineSources = Object.freeze({
	"src/backends/php/php-wasm-copied-host.mjs": "293fe19a7bbe5465faf8644e6b89485b609fc5c7efbf231c45da72cec8f4f41c"
	, "tests/helpers/php-graph-zend-receipt.mjs": "e1c96b3f34616183e1a2c7f45655e9b54204d9a867cea39317587d1185322b60"
	, "tests/helpers/php-wasm-graph-loading-receipt.mjs": "21cbf5a65585b9016dec4e0e008707344ea8ab96d34576c92a85ee43e1f2506b"
	, "tests/helpers/php-wasm-graph-receipt.mjs": "aab1c60a48ae80455efc6195264970d60b7bd9af1639b9cdb6e60ed46331bd9e"
	, "tests/php-wasm-collection-evidence.test.mjs": "e91b91360cd32bc123d6ec85e5b91e3e67f9e140cf19e4e5e530ab497d655bd3"
	, "tests/php-wasm-copied-package.test.mjs": "39937c2f8021d4278f57cade3eca41ec8f548b3193ac4062f3e2a7312aadfb18"
});
export const ownedPhpWasmChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/contributing/testing.md"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/php/callable-graph-zend-php.mjs"
	, "src/backends/php/copied-zend.mjs"
	, "src/backends/php/php-wasm-copied-host.mjs"
	, "src/backends/php/php-wasm-copied-loader.mjs"
	, "src/backends/php/zend-callables.mjs"
	, "src/build/canonical-build.mjs"
	, "src/build/lake-entry-intent.mjs"
	, "src/build/multi-profile-project.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-graph-model.mjs"
	, "src/build/php-wasm-project.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/helpers/jvm-thread-exit-repair-history.mjs"
	, "tests/helpers/owned-php-package-evidence.mjs"
	, "tests/helpers/owned-php-ci.mjs"
	, "tests/helpers/php-ci-regression-evidence.mjs"
	, "tests/helpers/php-graph-zend-receipt.mjs"
	, "tests/helpers/php-nix-boundary-repair-evidence.mjs"
	, "tests/helpers/php-nix-boundary-repair-history.mjs"
	, "tests/helpers/php-wasm-graph-packages.mjs"
	, "tests/helpers/php-wasm-graph-loading-receipt.mjs"
	, "tests/helpers/php-wasm-graph-receipt.mjs"
	, "tests/helpers/php-wasm-legacy-comparison.mjs"
	, "tests/helpers/php-wasm-recursive-callable-probes.mjs"
	, "tests/helpers/php-wasm-recursive-callable-receipt.mjs"
	, "tests/helpers/php-wasm-shared-regression-receipt.mjs"
	, "tests/helpers/php-wasm-structured-callable-evidence.mjs"
	, "tests/helpers/php-wasm-structured-callable-regression.mjs"
	, "tests/php-ci-regressions.test.mjs"
	, "tests/owned-php-ci.test.mjs"
	, "tests/php-collection-evidence.test.mjs"
	, "tests/php-nix-boundary-repair-evidence.test.mjs"
	, "tests/php-wasm-callable-contract.test.mjs"
	, "tests/php-wasm-copied-package.test.mjs"
	, "tests/php-wasm-collection-evidence.test.mjs"
	, "tests/php-wasm-recursive-callable-contract.test.mjs"
].sort();
export const ownedPhpWasmAddedPaths = [
	"docs/evidence/owned-php-wasm-cli-20260928.md"
	, "docs/evidence/owned-php-wasm-integration-20260928.md"
	, "docs/evidence/owned-php-wasm-packages-20260928.md"
	, "docs/evidence/owned-php-zend-calls-20260928.md"
	, "src/backends/php/owned-zend-callbacks.mjs"
	, "src/backends/php/owned-zend-descriptors.mjs"
	, "src/backends/php/owned-zend-extension.mjs"
	, "src/backends/php/owned-zend-model.mjs"
	, "src/backends/php/owned-zend-ownership.mjs"
	, "src/backends/php/owned-zend-php.mjs"
	, "src/backends/php/owned-zend-readme.mjs"
	, "src/backends/php/owned-zend-walk.mjs"
	, "src/backends/php/owned-zend-wire.mjs"
	, "src/build/php-wasm-owned-component.mjs"
	, "src/build/php-wasm-owned-model.mjs"
	, "tests/fixtures/structured-types/owned-php-wasm-installed.php"
	, "tests/fixtures/structured-types/owned-php-zend-bailouts.php"
	, "tests/fixtures/structured-types/owned-php-zend-fiber.php"
	, "tests/fixtures/structured-types/owned-php-zend-generated-bailouts.php"
	, "tests/fixtures/structured-types/owned-php-zend-generated-malformed.php"
	, "tests/fixtures/structured-types/owned-php-zend-generated-probe.php"
	, "tests/fixtures/structured-types/owned-php-zend-generated-recovery.php"
	, "tests/fixtures/structured-types/owned-php-zend-generated.php"
	, "tests/fixtures/structured-types/owned-php-zend-ownership.php"
	, "tests/helpers/owned-php-wasm-browser.mjs"
	, "tests/helpers/owned-php-wasm-ci.mjs"
	, "tests/helpers/owned-php-wasm-cli.mjs"
	, "tests/helpers/owned-php-wasm-coexistence-browser.mjs"
	, "tests/helpers/owned-php-wasm-coexistence.mjs"
	, "tests/helpers/owned-php-wasm-observer.mjs"
	, "tests/helpers/owned-php-wasm-package-evidence.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/helpers/owned-php-wasm-runtime.mjs"
	, "tests/helpers/owned-php-wasm-source-history.mjs"
	, "tests/helpers/owned-php-zend-generated-probe.mjs"
	, "tests/helpers/owned-php-zend-generated.mjs"
	, "tests/helpers/owned-php-zend-native.mjs"
	, "tests/helpers/owned-php-zend-output-probe.mjs"
	, "tests/helpers/owned-php-zend-ownership-probe.mjs"
	, "tests/helpers/owned-php-zend-ownership.mjs"
	, "tests/helpers/pre-owned-php-wasm-generators.mjs"
	, "tests/owned-php-wasm-ci.test.mjs"
	, "tests/owned-php-wasm-cli.test.mjs"
	, "tests/owned-php-wasm-documentation.test.mjs"
	, "tests/owned-php-wasm-evidence.test.mjs"
	, "tests/owned-php-wasm-model.test.mjs"
	, "tests/owned-php-wasm-multi-profile.test.mjs"
	, "tests/owned-php-wasm-package.test.mjs"
	, "tests/owned-php-zend-extension.test.mjs"
	, "tests/owned-php-zend-generated.test.mjs"
	, "tests/owned-php-zend-model.test.mjs"
	, "tests/owned-php-zend-ownership.test.mjs"
].sort();
let cached;
export const ownedPhpWasmNormalizationPaths = [...new Set([...ownedPhpWasmChangedPaths, ...ownedJavaScriptWasmChangedPaths])].sort();

/**
 * Reverse only recorded literal edits with matching complete file identities.
 *
 * @param source - Complete current text.
 * @param update - Exact ordered edits and current/predecessor identities.
 */
export const reverseOwnedPhpWasmUpdate = (source, update) => {
	assert.ok(ownedPhpWasmChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPhpWasmPackages = (path, source, expected) => {
	source = beforeOwnedJavaScriptWasm(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !ownedPhpWasmChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPhpWasmHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-wasm-integration");
	assert.equal(record.baselineRevision, ownedPhpWasmBaseline);
	assert.deepEqual(record.previous, ownedPhpWasmPrevious);
	assert.deepEqual(record.baselineSources, ownedPhpWasmBaselineSources);
	assert.deepEqual(record.updates.map(item => item.path), ownedPhpWasmChangedPaths);
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPhpWasmUpdate(source, update) : source;
};

/**
 * Normalize declared text paths while retaining unrelated bytes exactly.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current or predecessor bytes.
 * @param expected - Optional complete predecessor identity.
 */
export const ownedPhpWasmHistoricalBytes = (path, bytes, expected) => ownedPhpWasmNormalizationPaths.includes(path)
	? beforeOwnedPhpWasmPackages(path, bytes.toString("utf8"), expected) : bytes;
