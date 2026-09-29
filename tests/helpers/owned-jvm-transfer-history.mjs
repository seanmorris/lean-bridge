/**
 * Preserve frozen receipts across installed Java/Kotlin input-transfer support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedPerlTransfer, ownedPerlTransferChangedPaths } from "./owned-perl-transfer-history.mjs";

export const ownedJvmTransferBaseline = "7dd8a21aa6a245693fbd27fbadb3895b10b8d174";
export const ownedJvmTransferPath = "docs/evidence/owned-jvm-transfers-20260929.json";
export const ownedJvmTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-dotnet-transfers-20260929.json"
	, sha256: "2197870f2abacb53b7bc38715e65ee2e09765bf2975869494120c21fe22810e2"
});
export const ownedJvmTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/cargo.md"
	, "docs/publish/cpp.md"
	, "docs/publish/maven.md"
	, "docs/publish/nuget.md"
	, "docs/publish/pypi.md"
	, "docs/publish/rubygems.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/jvm/owned-calls.mjs"
	, "src/backends/jvm/owned-conversion-runtime.mjs"
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
	, "tests/helpers/owned-dotnet-transfer-history.mjs"
	, "tests/helpers/owned-jvm-call-fixture.mjs"
	, "tests/helpers/owned-jvm-conversion-evidence.mjs"
	, "tests/helpers/owned-jvm-conversion-native.mjs"
	, "tests/helpers/owned-jvm-installed-signatures.mjs"
	, "tests/helpers/owned-jvm-package-tamper.mjs"
	, "tests/helpers/owned-jvm-runtime-evidence.mjs"
	, "tests/helpers/owned-ruby-transfer-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/owned-dotnet-transfer-evidence.test.mjs"
].sort();
export const ownedJvmTransferNormalizationPaths = [...new Set([...ownedJvmTransferChangedPaths, ...ownedPerlTransferChangedPaths])].sort();
export const ownedJvmTransferAddedPaths = [
	"docs/evidence/owned-jvm-transfers-20260929.md"
	, "src/backends/jvm/owned-transfers.mjs"
	, "tests/fixtures/documentation/consumers/java/OwnedTransferExample.java"
	, "tests/fixtures/documentation/consumers/kotlin/OwnedTransferExample.kt"
	, "tests/fixtures/structured-types/owned-jvm-transfers.java"
	, "tests/fixtures/structured-types/owned-kotlin-transfers.kt"
	, "tests/helpers/owned-jvm-transfer-evidence.mjs"
	, "tests/helpers/owned-jvm-transfer-history.mjs"
	, "tests/helpers/owned-jvm-transfer-installed.mjs"
	, "tests/owned-jvm-transfer-evidence.test.mjs"
	, "tests/owned-jvm-transfer-packaging.test.mjs"
	, "tests/owned-jvm-transfers.test.mjs"
].sort();
let cached;

/**
 * Authenticate complete sources before reversing exact ordered edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact current and previous identities and reversible edits.
 */
export const reverseOwnedJvmTransferUpdate = (source, update) => {
	assert.ok(ownedJvmTransferChangedPaths.includes(update.path), update.path);
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
 * Preserve unknown changes and stop at explicitly requested historical bytes.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional historical stopping digest.
 */
export const beforeOwnedJvmTransfer = (path, source, expected) => {
	source = beforeOwnedPerlTransfer(path, source, expected);
	if(!ownedJvmTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedJvmTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-jvm-transfers");
	assert.equal(record.baselineRevision, ownedJvmTransferBaseline);
	assert.deepEqual(record.previous, ownedJvmTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedJvmTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedJvmTransferUpdate(source, update) : source;
};

/**
 * Decode only registered text paths; preserve unrelated binary inputs.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedJvmTransferHistoricalBytes = (path, bytes, expected) => ownedJvmTransferNormalizationPaths.includes(path)
	? beforeOwnedJvmTransfer(path, bytes.toString("utf8"), expected) : bytes;
