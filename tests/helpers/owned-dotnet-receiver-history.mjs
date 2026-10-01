/**
 * Authenticate exact predecessor sources across Dotnet receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedJvmReceiver, ownedJvmReceiverNormalizationPaths } from "./owned-jvm-receiver-history.mjs";

export const ownedDotnetReceiverPath = "docs/evidence/owned-dotnet-receivers-20261001.json";
export const ownedDotnetReceiverBaseline = "7f1a432b5cffb9a0cddfa2fef30440f9847afc39";
export const ownedDotnetReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-ruby-receivers-20261001.json"
	, sha256: "589e5076905f367c8a4d700843c796a8edafa672e426e70f636baf59b48f99b3"
});
export const ownedDotnetReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/consume/dotnet.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/nuget.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/dotnet/owned-borrows.mjs"
	, "src/backends/dotnet/owned-callables.mjs"
	, "src/backends/dotnet/owned-calls.mjs"
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
	, "tests/helpers/owned-python-receiver-history.mjs"
	, "tests/helpers/owned-ruby-receiver-evidence.mjs"
	, "tests/helpers/owned-ruby-receiver-history.mjs"
	, "tests/owned-ruby-receiver-evidence.test.mjs"
].sort();
export const ownedDotnetReceiverAddedPaths = [
	"docs/evidence/owned-dotnet-receivers-20261001.md"
	, "src/backends/dotnet/owned-receivers.mjs"
	, "tests/fixtures/documentation/consumers/dotnet/owned-receivers.cs"
	, "tests/fixtures/structured-types/owned-dotnet-receivers.cs"
	, "tests/helpers/owned-dotnet-receiver-ci.mjs"
	, "tests/helpers/owned-dotnet-receiver-evidence.mjs"
	, "tests/helpers/owned-dotnet-receiver-fixture.mjs"
	, "tests/helpers/owned-dotnet-receiver-history.mjs"
	, "tests/helpers/owned-dotnet-receiver-installed.mjs"
	, "tests/helpers/owned-dotnet-receiver-package-evidence.mjs"
	, "tests/owned-dotnet-receiver-contract.test.mjs"
	, "tests/owned-dotnet-receiver-evidence.test.mjs"
	, "tests/owned-dotnet-receiver-packaging.test.mjs"
	, "tests/owned-dotnet-receiver-plain.test.mjs"
	, "tests/owned-dotnet-receivers.test.mjs"
].sort();
let cached;
export const ownedDotnetReceiverNormalizationPaths = [...new Set([...ownedDotnetReceiverChangedPaths, ...ownedJvmReceiverNormalizationPaths])].sort();

/**
 * Reverse registered edit spans after checking both complete source identities.
 *
 * @param source - Complete current text.
 * @param update - Authenticated path, identities and replacement spans.
 */
export const reverseOwnedDotnetReceiverUpdate = (source, update) => {
	assert.ok(ownedDotnetReceiverChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedDotnetReceiver = (path, source, expected) => {
	source = beforeOwnedJvmReceiver(path, source, expected);
	if(!ownedDotnetReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedDotnetReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedDotnetReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedDotnetReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-dotnet-receivers");
	assert.equal(cached.baselineRevision, ownedDotnetReceiverBaseline);
	assert.deepEqual(cached.previous, ownedDotnetReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedDotnetReceiverChangedPaths);
	const update = cached.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedDotnetReceiverUpdate(source, update) : source;
};

/**
 * Preserve binary inputs and decode only the registered text paths.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedDotnetReceiverHistoricalBytes = (path, bytes, expected) => ownedDotnetReceiverNormalizationPaths.includes(path)
	? beforeOwnedDotnetReceiver(path, bytes.toString("utf8"), expected) : bytes;
