/**
 * Preserve frozen receipts across installed Python input-transfer support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedRubyTransfer, ownedRubyTransferNormalizationPaths } from "./owned-ruby-transfer-history.mjs";

export const ownedPythonTransferBaseline = "008b0ae88d43beaa82c27b60d8ab65c8755a602a";
export const ownedPythonTransferPath = "docs/evidence/owned-python-transfers-20260929.json";
export const ownedPythonTransferPrevious = Object.freeze({
	path: "docs/evidence/owned-consumer-ci-repair-20260929.json"
	, sha256: "e1c1e41df32a26c7555a616d099217343336ca78370aab34a52fe04ad43bfd52"
});
export const ownedPythonTransferChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/consume/c.md"
	, "docs/consume/python.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/cargo.md"
	, "docs/publish/cpp.md"
	, "docs/publish/pypi.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/python/owned-conversions.mjs"
	, "src/backends/python/owned-package.mjs"
	, "src/backends/python/owned-runtime.mjs"
	, "src/backends/python/owned-values.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-c-projection.mjs"
	, "src/build/owned-python-artifacts.mjs"
	, "src/build/owned-rust-artifacts.mjs"
	, "src/release/owned-pypi.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-consumer-ci-repair-history.mjs"
	, "tests/helpers/owned-rust-transfer-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/owned-consumer-ci-repair.test.mjs"
	, "tests/owned-rust-transfer-packaging.test.mjs"
].sort();
export const ownedPythonTransferAddedPaths = [
	"docs/evidence/owned-python-transfers-20260929.md"
	, "src/backends/python/owned-transfers.mjs"
	, "tests/fixtures/documentation/consumers/python/owned-transfers.py"
	, "tests/fixtures/structured-types/owned-installed-python-transfers.py"
	, "tests/fixtures/structured-types/owned-python-transfers.py"
	, "tests/helpers/owned-python-transfer-evidence.mjs"
	, "tests/helpers/owned-python-transfer-history.mjs"
	, "tests/owned-python-transfer-evidence.test.mjs"
	, "tests/owned-python-transfer-packaging.test.mjs"
	, "tests/owned-python-transfers.test.mjs"
].sort();
let cached;
export const ownedPythonTransferNormalizationPaths = [...new Set([...ownedPythonTransferChangedPaths, ...ownedRubyTransferNormalizationPaths])].sort();

/**
 * Authenticate complete sources before reversing exact ordered edit spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact current and previous identities and reversible edits.
 */
export const reverseOwnedPythonTransferUpdate = (source, update) => {
	assert.ok(ownedPythonTransferChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPythonTransfer = (path, source, expected) => {
	source = beforeOwnedRubyTransfer(path, source, expected);
	if(!ownedPythonTransferChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPythonTransferPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-python-transfers");
	assert.equal(record.baselineRevision, ownedPythonTransferBaseline);
	assert.deepEqual(record.previous, ownedPythonTransferPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedPythonTransferChangedPaths);
	const update = record.updates.find(update => update.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPythonTransferUpdate(source, update) : source;
};

/**
 * Decode only registered text paths; preserve unrelated binary inputs.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional historical stopping digest.
 */
export const ownedPythonTransferHistoricalBytes = (path, bytes, expected) => ownedPythonTransferNormalizationPaths.includes(path)
	? beforeOwnedPythonTransfer(path, bytes.toString("utf8"), expected) : bytes;
