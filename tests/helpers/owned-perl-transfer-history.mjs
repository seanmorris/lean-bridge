/**
 * Preserve frozen receipts across installed Perl input-transfer support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedPerlTransferBaseline = "9591a41dd71d74db92a614cbfa352a712359945c";
export const ownedPerlTransferPath = "docs/evidence/owned-perl-transfers-20260929.json";
export const ownedPerlTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-jvm-transfers-20260929.json"
	, sha256: "1cfe0fd4f41a82f00f577d0788ac0c56408f33e429376fa73365f7d90640e41e"
});
// This existing fixture was outside the predecessor's source inventory.
// Pin its baseline bytes before including the CI repair in this receipt.
export const ownedPerlTransferRegisteredSources = Object.freeze({
	"tests/fixtures/documentation/consumers/dotnet/Consumer.csproj": "9595dc828c77417d8024d441dfd4704b987feacacd45f1199e9c2d0c7cb42019"
});
export const ownedPerlTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/perl.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/cargo.md"
	, "docs/publish/cpan.md"
	, "docs/publish/cpp.md"
	, "docs/publish/maven.md"
	, "docs/publish/nuget.md"
	, "docs/publish/pypi.md"
	, "docs/publish/rubygems.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/backends/perl/Build.pm"
	, "src/backends/perl/owned-conversions.mjs"
	, "src/backends/perl/owned-package.mjs"
	, "src/backends/perl/owned-runtime.mjs"
	, "src/backends/perl/owned-values.mjs"
	, "src/backends/perl/owned-xs.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-perl-projection.mjs"
	, "src/release/cpan-package.mjs"
	, "tests/documentation.test.mjs"
	, "tests/fixtures/documentation/consumers/dotnet/Consumer.csproj"
	, "tests/helpers/owned-cpp-transfer-evidence.mjs"
	, "tests/helpers/owned-dotnet-transfer-evidence.mjs"
	, "tests/helpers/owned-dotnet-transfer-history.mjs"
	, "tests/helpers/owned-javascript-nix-evidence.mjs"
	, "tests/helpers/owned-jvm-transfer-evidence.mjs"
	, "tests/helpers/owned-jvm-transfer-history.mjs"
	, "tests/helpers/owned-perl-native.mjs"
	, "tests/helpers/owned-python-transfer-evidence.mjs"
	, "tests/helpers/owned-ruby-transfer-evidence.mjs"
	, "tests/helpers/owned-rust-transfer-evidence.mjs"
	, "tests/helpers/owned-transfer-c-evidence.mjs"
	, "tests/helpers/owned-transfer-package-evidence.mjs"
	, "tests/helpers/wit-owned-package-evidence.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/owned-javascript-nix-evidence.test.mjs"
	, "tests/owned-cpp-transfer-packaging.test.mjs"
	, "tests/owned-jvm-transfer-evidence.test.mjs"
	, "tests/owned-perl-documentation.test.mjs"
	, "tests/wit-owned-package-evidence.test.mjs"
].sort();
export const ownedPerlTransferAddedPaths = [
	"docs/evidence/owned-perl-transfers-20260929.md"
	, "src/backends/perl/owned-transfers.mjs"
	, "src/release/owned-cpan-contract.mjs"
	, "tests/fixtures/structured-types/owned-perl-transfers.pl"
	, "tests/helpers/owned-perl-transfer-evidence.mjs"
	, "tests/helpers/owned-perl-transfer-history.mjs"
	, "tests/helpers/owned-transfer-generated-history.mjs"
	, "tests/owned-perl-transfer-evidence.test.mjs"
	, "tests/owned-perl-transfer-packaging.test.mjs"
	, "tests/owned-perl-transfers.test.mjs"
].sort();
let cached;

/**
 * Authenticate complete sources before reversing exact ordered edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact current and previous identities and reversible edits.
 */
export const reverseOwnedPerlTransferUpdate = (source, update) => {
	assert.ok(ownedPerlTransferChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPerlTransfer = (path, source, expected) => {
	if(!ownedPerlTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPerlTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-perl-transfers");
	assert.equal(record.baselineRevision, ownedPerlTransferBaseline);
	assert.deepEqual(record.previous, ownedPerlTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedPerlTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPerlTransferUpdate(source, update) : source;
};

/**
 * Decode only registered text paths; preserve unrelated binary inputs.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedPerlTransferHistoricalBytes = (path, bytes, expected) => ownedPerlTransferChangedPaths.includes(path)
	? beforeOwnedPerlTransfer(path, bytes.toString("utf8"), expected) : bytes;
