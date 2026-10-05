/**
 * Preserve frozen receipts across installed C# input-transfer support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedJvmTransfer, ownedJvmTransferNormalizationPaths } from "./owned-jvm-transfer-history.mjs";

export const ownedDotnetTransferBaseline = "ea7759886937d82bc6c8c2c90f867b99e8ea10e0";
export const ownedDotnetTransferPath = "docs/evidence/owned-dotnet-transfers-20260929.json";
export const ownedDotnetTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-ruby-transfers-20260929.json"
	, sha256: "4dac369ca03907493455adc7512a5c2b33be58574d9c6602ddece1febcf9ac17"
});
export const ownedDotnetTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/consume/dotnet.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/cargo.md"
	, "docs/publish/cpp.md"
	, "docs/publish/nuget.md"
	, "docs/publish/pypi.md"
	, "docs/publish/rubygems.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/dotnet/owned-calls.mjs"
	, "src/backends/dotnet/owned-conversion-runtime.mjs"
	, "src/backends/dotnet/owned-conversions.mjs"
	, "src/backends/dotnet/owned-layout.mjs"
	, "src/backends/dotnet/owned-package.mjs"
	, "src/backends/dotnet/owned-runtime.mjs"
	, "src/backends/dotnet/owned-values.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-dotnet-artifacts.mjs"
	, "src/build/owned-dotnet-projection.mjs"
	, "src/release/owned-nuget.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-dotnet-native.mjs"
	, "tests/helpers/owned-python-transfer-history.mjs"
	, "tests/helpers/owned-ruby-transfer-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/owned-ruby-transfer-evidence.test.mjs"
].sort();
export const ownedDotnetTransferAddedPaths = [
	"docs/evidence/owned-dotnet-transfers-20260929.md"
	, "src/backends/dotnet/owned-transfers.mjs"
	, "tests/fixtures/documentation/consumers/dotnet/owned-transfers.cs"
	, "tests/fixtures/structured-types/owned-dotnet-transfers.cs"
	, "tests/fixtures/structured-types/owned-installed-dotnet-transfers.cs"
	, "tests/helpers/owned-dotnet-transfer-evidence.mjs"
	, "tests/helpers/owned-dotnet-transfer-history.mjs"
	, "tests/helpers/owned-dotnet-transfer-installed.mjs"
	, "tests/owned-dotnet-transfer-evidence.test.mjs"
	, "tests/owned-dotnet-transfer-packaging.test.mjs"
	, "tests/owned-dotnet-transfers.test.mjs"
].sort();
let cached;
export const ownedDotnetTransferNormalizationPaths = [...new Set([...ownedDotnetTransferChangedPaths, ...ownedJvmTransferNormalizationPaths])].sort();

/**
 * Authenticate complete sources before reversing exact ordered edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact current and previous identities and reversible edits.
 */
export const reverseOwnedDotnetTransferUpdate = (source, update) => {
	assert.ok(ownedDotnetTransferChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedDotnetTransfer = (path, source, expected) => {
	source = beforeOwnedJvmTransfer(path, source, expected);
	if(!ownedDotnetTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedDotnetTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-dotnet-transfers");
	assert.equal(record.baselineRevision, ownedDotnetTransferBaseline);
	assert.deepEqual(record.previous, ownedDotnetTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedDotnetTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedDotnetTransferUpdate(source, update) : source;
};

/**
 * Decode only registered text paths; preserve unrelated binary inputs.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedDotnetTransferHistoricalBytes = (path, bytes, expected) => ownedDotnetTransferNormalizationPaths.includes(path)
	? beforeOwnedDotnetTransfer(path, bytes.toString("utf8"), expected) : bytes;
