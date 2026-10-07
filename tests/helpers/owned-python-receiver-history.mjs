/**
 * Authenticate exact predecessor sources across Python receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedRubyReceiver, ownedRubyReceiverNormalizationPaths } from "./owned-ruby-receiver-history.mjs";

export const ownedPythonReceiverPath = "docs/evidence/owned-python-receivers-20261001.json";
export const ownedPythonReceiverBaseline = "18324f5a302fb99238b8a503114b3f5a5294d3cd";
export const ownedPythonReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-rust-receivers-20261001.json"
	, sha256: "49f0a64551d0fac12b5890d7dbff730a7dab78bef23bb819e315eb954906fc3e"
});
export const ownedPythonReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/consume/python.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/pypi.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/python/owned-borrows.mjs"
	, "src/backends/python/owned-callables.mjs"
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
	, "tests/helpers/owned-cpp-receiver-evidence.mjs"
	, "tests/helpers/owned-cpp-receiver-history.mjs"
	, "tests/helpers/owned-receiver-evidence.mjs"
	, "tests/helpers/owned-rust-receiver-evidence.mjs"
	, "tests/helpers/owned-rust-receiver-history.mjs"
	, "tests/helpers/wit-owned-borrow-evidence.mjs"
	, "tests/owned-rust-receiver-evidence.test.mjs"
].sort();
export const ownedPythonReceiverAddedPaths = [
	"docs/evidence/owned-python-receivers-20261001.md"
	, "src/backends/python/owned-receivers.mjs"
	, "tests/fixtures/documentation/consumers/python/owned-receivers.py"
	, "tests/fixtures/structured-types/owned-python-receivers.py"
	, "tests/helpers/owned-python-receiver-ci.mjs"
	, "tests/helpers/owned-python-receiver-evidence.mjs"
	, "tests/helpers/owned-python-receiver-fixture.mjs"
	, "tests/helpers/owned-python-receiver-history.mjs"
	, "tests/helpers/owned-receiver-cli.mjs"
	, "tests/owned-python-receiver-contract.test.mjs"
	, "tests/owned-python-receiver-evidence.test.mjs"
	, "tests/owned-python-receiver-packaging.test.mjs"
	, "tests/owned-python-receiver-plain.test.mjs"
	, "tests/owned-python-receivers.test.mjs"
].sort();
let cached;
export const ownedPythonReceiverNormalizationPaths = [...new Set([...ownedPythonReceiverChangedPaths, ...ownedRubyReceiverNormalizationPaths])].sort();

/**
 * Reverse registered edit spans after checking both complete source identities.
 *
 * @param source - Complete current text.
 * @param update - Authenticated path, identities and replacement spans.
 */
export const reverseOwnedPythonReceiverUpdate = (source, update) => {
	assert.ok(ownedPythonReceiverChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPythonReceiver = (path, source, expected) => {
	source = beforeOwnedRubyReceiver(path, source, expected);
	if(!ownedPythonReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedPythonReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedPythonReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedPythonReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-python-receivers");
	assert.equal(cached.baselineRevision, ownedPythonReceiverBaseline);
	assert.deepEqual(cached.previous, ownedPythonReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedPythonReceiverChangedPaths);
	const update = cached.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedPythonReceiverUpdate(source, update) : source;
};

/**
 * Preserve binary inputs and decode only the registered text paths.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedPythonReceiverHistoricalBytes = (path, bytes, expected) => ownedPythonReceiverNormalizationPaths.includes(path)
	? beforeOwnedPythonReceiver(path, bytes.toString("utf8"), expected) : bytes;
