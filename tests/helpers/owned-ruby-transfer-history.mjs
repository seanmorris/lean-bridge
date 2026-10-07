/**
 * Preserve frozen receipts across installed Ruby input-transfer support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedDotnetTransfer, ownedDotnetTransferNormalizationPaths } from "./owned-dotnet-transfer-history.mjs";

export const ownedRubyTransferBaseline = "e038e5c6178e5495a0b1a7712b00b1b6998bfd59";
export const ownedRubyTransferPath = "docs/evidence/owned-ruby-transfers-20260929.json";
export const ownedRubyTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-python-transfers-20260929.json"
	, sha256: "5528d0e8572ad8160e1a084b1e86a7106e821bf879b92a45f20ea18446e70750"
});
export const ownedRubyTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/cargo.md"
	, "docs/publish/cpp.md"
	, "docs/publish/pypi.md"
	, "docs/publish/rubygems.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/ruby/owned-call-boundary.mjs"
	, "src/backends/ruby/owned-conversion-runtime.mjs"
	, "src/backends/ruby/owned-conversions.mjs"
	, "src/backends/ruby/owned-layout.mjs"
	, "src/backends/ruby/owned-package.mjs"
	, "src/backends/ruby/owned-runtime.mjs"
	, "src/backends/ruby/owned-values.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-ruby-artifacts.mjs"
	, "src/build/owned-ruby-projection.mjs"
	, "src/release/owned-rubygems.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-consumer-ci-repair-history.mjs"
	, "tests/helpers/owned-python-transfer-history.mjs"
	, "tests/helpers/owned-ruby-conversion-evidence.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/owned-python-transfer-evidence.test.mjs"
].sort();
export const ownedRubyTransferAddedPaths = [
	"docs/evidence/owned-ruby-transfers-20260929.md"
	, "src/backends/ruby/owned-transfers.mjs"
	, "tests/fixtures/documentation/consumers/ruby/owned-transfers.rb"
	, "tests/fixtures/structured-types/owned-installed-ruby-transfers.rb"
	, "tests/fixtures/structured-types/owned-ruby-transfers.rb"
	, "tests/helpers/owned-ruby-transfer-evidence.mjs"
	, "tests/helpers/owned-ruby-transfer-history.mjs"
	, "tests/owned-ruby-transfer-evidence.test.mjs"
	, "tests/owned-ruby-transfer-packaging.test.mjs"
	, "tests/owned-ruby-transfers.test.mjs"
].sort();
let cached;
export const ownedRubyTransferNormalizationPaths = [...new Set([...ownedRubyTransferChangedPaths, ...ownedDotnetTransferNormalizationPaths])].sort();

/**
 * Authenticate complete sources before reversing exact ordered edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact current and previous identities and reversible edits.
 */
export const reverseOwnedRubyTransferUpdate = (source, update) => {
	assert.ok(ownedRubyTransferChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedRubyTransfer = (path, source, expected) => {
	source = beforeOwnedDotnetTransfer(path, source, expected);
	if(!ownedRubyTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedRubyTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-ruby-transfers");
	assert.equal(record.baselineRevision, ownedRubyTransferBaseline);
	assert.deepEqual(record.previous, ownedRubyTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedRubyTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedRubyTransferUpdate(source, update) : source;
};

/**
 * Decode only registered text paths; preserve unrelated binary inputs.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedRubyTransferHistoricalBytes = (path, bytes, expected) => ownedRubyTransferNormalizationPaths.includes(path)
	? beforeOwnedRubyTransfer(path, bytes.toString("utf8"), expected) : bytes;
