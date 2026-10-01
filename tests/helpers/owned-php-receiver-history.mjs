/**
 * Authenticate exact predecessor sources across native PHP receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedPhpReceiverPath = "docs/evidence/owned-php-receivers-20261001.json";
export const ownedPhpReceiverBaseline = "ffc4b5d9c881be809a17649c545be8bbb24a0110";
export const ownedPhpReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-perl-receivers-20261001.json"
	, sha256: "98d2e6d3da46f90e38554cffe30dc972b70dbfd7b3437dd3d80e0c3d4eb8e494"
});
export const ownedPhpReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/publish/c.md"
	, "docs/publish/php.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/owned-package.mjs"
	, "src/backends/c/owned-values.mjs"
	, "src/backends/php/owned-call-runtime.mjs"
	, "src/backends/php/owned-calls.mjs"
	, "src/backends/php/owned-conversions.mjs"
	, "src/backends/php/owned-package.mjs"
	, "src/backends/php/owned-runtime.mjs"
	, "src/backends/php/owned-values.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-php-artifacts.mjs"
	, "src/build/owned-php-projection.mjs"
	, "src/release/owned-composer.mjs"
	, "tests/helpers/owned-jvm-receiver-history.mjs"
	, "tests/helpers/owned-perl-receiver-history.mjs"
	, "tests/helpers/owned-perl-receiver-package-evidence.mjs"
	, "tests/helpers/owned-php-native.mjs"
	, "tests/owned-perl-receiver-evidence.test.mjs"
	, "tests/owned-php-ci.test.mjs"
].sort();
export const ownedPhpReceiverAddedPaths = [
	"docs/evidence/owned-php-receivers-20261001.md"
	, "src/backends/php/owned-receivers.mjs"
	, "tests/fixtures/structured-types/owned-php-receivers.php"
	, "tests/helpers/owned-php-receiver-ci.mjs"
	, "tests/helpers/owned-php-receiver-evidence.mjs"
	, "tests/helpers/owned-php-receiver-fixture.mjs"
	, "tests/helpers/owned-php-receiver-history.mjs"
	, "tests/helpers/owned-php-receiver-installed.mjs"
	, "tests/helpers/owned-php-receiver-mutants.mjs"
	, "tests/helpers/owned-php-receiver-package-evidence.mjs"
	, "tests/owned-php-receiver-ci.test.mjs"
	, "tests/owned-php-receiver-documentation.test.mjs"
	, "tests/owned-php-receiver-evidence.test.mjs"
	, "tests/owned-php-receiver-packaging.test.mjs"
	, "tests/owned-php-receiver-resource-packaging.test.mjs"
	, "tests/owned-php-receivers.test.mjs"
].sort();
let cached;

/**
 * Reverse registered edit spans after checking both complete source identities.
 *
 * @param source - Complete current text.
 * @param update - Authenticated path, identities and replacement spans.
 */
export const reverseOwnedPhpReceiverUpdate = (source, update) => {
	assert.ok(ownedPhpReceiverChangedPaths.includes(update.path), update.path);
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
 * Stop at requested identities and never conceal unrecorded changes.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping identity.
 */
export const beforeOwnedPhpReceiver = (path, source, expected) => {
	if(!ownedPhpReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedPhpReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedPhpReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedPhpReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-php-receivers");
	assert.equal(cached.baselineRevision, ownedPhpReceiverBaseline);
	assert.deepEqual(cached.previous, ownedPhpReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedPhpReceiverChangedPaths);
	const update = cached.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedPhpReceiverUpdate(source, update) : source;
};

/**
 * Preserve binary inputs and decode only the registered text paths.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedPhpReceiverHistoricalBytes = (path, bytes, expected) => ownedPhpReceiverChangedPaths.includes(path)
	? beforeOwnedPhpReceiver(path, bytes.toString("utf8"), expected) : bytes;
