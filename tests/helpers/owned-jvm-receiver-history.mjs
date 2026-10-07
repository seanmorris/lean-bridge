/**
 * Authenticate exact predecessor sources across JVM receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedPerlReceiver, ownedPerlReceiverNormalizationPaths } from "./owned-perl-receiver-history.mjs";

export const ownedJvmReceiverPath = "docs/evidence/owned-jvm-receivers-20261001.json";
export const ownedJvmReceiverBaseline = "58750ab55e52114fa1d48715216fc5c049f4d683";
export const ownedJvmReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-dotnet-receivers-20261001.json"
	, sha256: "6b47f810bc3eca29c4596f19af81b37fc8e2e08d4da6ff700c30ec8ea4ce3e4c"
});
export const ownedJvmReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/maven.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/jvm/owned-borrows.mjs"
	, "src/backends/jvm/owned-callables.mjs"
	, "src/backends/jvm/owned-calls.mjs"
	, "src/backends/jvm/owned-conversions.mjs"
	, "src/backends/jvm/owned-kotlin.mjs"
	, "src/backends/jvm/owned-layout.mjs"
	, "src/backends/jvm/owned-package.mjs"
	, "src/backends/jvm/owned-runtime.mjs"
	, "src/backends/jvm/owned-values.mjs"
	, "src/build/compile-jvm-sources.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-jvm-artifacts.mjs"
	, "src/build/owned-jvm-projection.mjs"
	, "src/release/owned-maven.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-dotnet-receiver-history.mjs"
	, "tests/helpers/owned-dotnet-receiver-package-evidence.mjs"
	, "tests/helpers/owned-jvm-borrow-installed.mjs"
	, "tests/helpers/owned-jvm-call-fixture.mjs"
	, "tests/helpers/owned-jvm-installed-assets.mjs"
	, "tests/helpers/owned-jvm-installed-signatures.mjs"
	, "tests/helpers/owned-jvm-package-tamper.mjs"
	, "tests/helpers/owned-ruby-receiver-history.mjs"
	, "tests/owned-dotnet-receiver-evidence.test.mjs"
].sort();
export const ownedJvmReceiverAddedPaths = [
	"docs/evidence/owned-jvm-receivers-20261001.md"
	, "src/backends/jvm/owned-receivers.mjs"
	, "tests/fixtures/documentation/consumers/java/OwnedReceiverExample.java"
	, "tests/fixtures/documentation/consumers/kotlin/OwnedReceiverExample.kt"
	, "tests/fixtures/structured-types/owned-jvm-receiver-members.java"
	, "tests/fixtures/structured-types/owned-jvm-receiver-unanchored.java"
	, "tests/fixtures/structured-types/owned-kotlin-receiver-members.kt"
	, "tests/fixtures/structured-types/owned-kotlin-receiver-unanchored.kt"
	, "tests/helpers/owned-jvm-plain-receiver-installed.mjs"
	, "tests/helpers/owned-jvm-receiver-ci.mjs"
	, "tests/helpers/owned-jvm-receiver-companions.mjs"
	, "tests/helpers/owned-jvm-receiver-evidence.mjs"
	, "tests/helpers/owned-jvm-receiver-fixture.mjs"
	, "tests/helpers/owned-jvm-receiver-history.mjs"
	, "tests/helpers/owned-jvm-receiver-installed.mjs"
	, "tests/helpers/owned-jvm-receiver-package-evidence.mjs"
	, "tests/helpers/owned-jvm-receiver-rejections.mjs"
	, "tests/owned-jvm-receiver-core.test.mjs"
	, "tests/owned-jvm-receiver-evidence.test.mjs"
	, "tests/owned-jvm-receiver-packaging.test.mjs"
	, "tests/owned-jvm-receiver-plain.test.mjs"
	, "tests/owned-jvm-receiver-resource-packaging.test.mjs"
	, "tests/owned-jvm-receiver-unanchored.test.mjs"
].sort();
let cached;
export const ownedJvmReceiverNormalizationPaths = [...new Set([...ownedJvmReceiverChangedPaths, ...ownedPerlReceiverNormalizationPaths])].sort();

/**
 * Reverse registered edit spans after checking both complete source identities.
 *
 * @param source - Complete current text.
 * @param update - Authenticated path, identities and replacement spans.
 */
export const reverseOwnedJvmReceiverUpdate = (source, update) => {
	assert.ok(ownedJvmReceiverChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedJvmReceiver = (path, source, expected) => {
	source = beforeOwnedPerlReceiver(path, source, expected);
	if(!ownedJvmReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedJvmReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedJvmReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedJvmReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-jvm-receivers");
	assert.equal(cached.baselineRevision, ownedJvmReceiverBaseline);
	assert.deepEqual(cached.previous, ownedJvmReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedJvmReceiverChangedPaths);
	const update = cached.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedJvmReceiverUpdate(source, update) : source;
};

/**
 * Preserve binary inputs and decode only the registered text paths.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedJvmReceiverHistoricalBytes = (path, bytes, expected) => ownedJvmReceiverNormalizationPaths.includes(path)
	? beforeOwnedJvmReceiver(path, bytes.toString("utf8"), expected) : bytes;
