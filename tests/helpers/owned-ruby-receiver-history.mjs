/**
 * Authenticate exact predecessor sources across Ruby receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedDotnetReceiver, ownedDotnetReceiverNormalizationPaths } from "./owned-dotnet-receiver-history.mjs";

export const ownedRubyReceiverPath = "docs/evidence/owned-ruby-receivers-20261001.json";
export const ownedRubyReceiverBaseline = "5271f6b8c74d3e4295e6607cd13bd1271204a63e";
export const ownedRubyReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-python-receivers-20261001.json"
	, sha256: "527522cb74615df111ee5ee72cf28e85b80e9b66c6062b25d28828d1ba74e9df"
});
export const ownedRubyReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/ruby.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/rubygems.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/ruby/owned-call-boundary.mjs"
	, "src/backends/ruby/owned-callables.mjs"
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
	, "tests/helpers/owned-python-receiver-evidence.mjs"
	, "tests/helpers/owned-python-receiver-history.mjs"
	, "tests/helpers/owned-receiver-cli.mjs"
	, "tests/helpers/owned-rust-receiver-history.mjs"
	, "tests/owned-python-receiver-evidence.test.mjs"
].sort();
export const ownedRubyReceiverAddedPaths = [
	"docs/evidence/owned-ruby-receivers-20261001.md"
	, "tests/fixtures/documentation/consumers/ruby/owned-receivers.rb"
	, "tests/fixtures/structured-types/owned-ruby-receivers.rb"
	, "tests/helpers/owned-ruby-receiver-ci.mjs"
	, "tests/helpers/owned-ruby-receiver-evidence.mjs"
	, "tests/helpers/owned-ruby-receiver-fixture.mjs"
	, "tests/helpers/owned-ruby-receiver-history.mjs"
	, "tests/helpers/owned-ruby-receiver-installed.mjs"
	, "tests/owned-ruby-receiver-contract.test.mjs"
	, "tests/owned-ruby-receiver-evidence.test.mjs"
	, "tests/owned-ruby-receiver-packaging.test.mjs"
	, "tests/owned-ruby-receiver-plain.test.mjs"
	, "tests/owned-ruby-receivers.test.mjs"
].sort();
let cached;
export const ownedRubyReceiverNormalizationPaths = [...new Set([...ownedRubyReceiverChangedPaths, ...ownedDotnetReceiverNormalizationPaths])].sort();

/**
 * Reverse registered edit spans after checking both complete source identities.
 *
 * @param source - Complete current text.
 * @param update - Authenticated path, identities and replacement spans.
 */
export const reverseOwnedRubyReceiverUpdate = (source, update) => {
	assert.ok(ownedRubyReceiverChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedRubyReceiver = (path, source, expected) => {
	source = beforeOwnedDotnetReceiver(path, source, expected);
	if(!ownedRubyReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedRubyReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedRubyReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedRubyReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-ruby-receivers");
	assert.equal(cached.baselineRevision, ownedRubyReceiverBaseline);
	assert.deepEqual(cached.previous, ownedRubyReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedRubyReceiverChangedPaths);
	const update = cached.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedRubyReceiverUpdate(source, update) : source;
};

/**
 * Preserve binary inputs and decode only the registered text paths.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedRubyReceiverHistoricalBytes = (path, bytes, expected) => ownedRubyReceiverNormalizationPaths.includes(path)
	? beforeOwnedRubyReceiver(path, bytes.toString("utf8"), expected) : bytes;
