/**
 * Preserve exact predecessor sources across WIT receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedJvmReceiverGc, ownedJvmReceiverGcNormalizationPaths } from "./owned-jvm-receiver-gc-history.mjs";

export const ownedWitReceiverPath = "docs/evidence/wit-owned-receivers-20261001.json";
export const ownedWitReceiverBaseline = "3195b47fc2ef224a6b4d92501e0dadefb3b9a1f0";
export const ownedWitReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-javascript-receivers-20261001.json"
	, sha256: "ae137472164b6ae655dd6ace10465673fda2448b2d9dabfbeb0d5253e2e8b51d"
});
export const ownedWitReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/wit-wasi.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/wit-wasi.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/wit/owned-graph-model.mjs"
	, "src/backends/wit/owned-package.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-wit-artifacts.mjs"
	, "src/build/owned-wit-projection.mjs"
	, "src/release/owned-wasi.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/owned-javascript-receiver-history.mjs"
	, "tests/helpers/owned-php-wasm-receiver-history.mjs"
	, "tests/owned-javascript-receiver-evidence.test.mjs"
].sort();
export const ownedWitReceiverAddedPaths = [
	"docs/evidence/wit-owned-receivers-20261001.md"
	, "tests/fixtures/structured-types/owned-wit-resource-receivers.c"
	, "tests/helpers/wit-owned-receiver-ci.mjs"
	, "tests/helpers/wit-owned-receiver-configurations.mjs"
	, "tests/helpers/wit-owned-receiver-evidence.mjs"
	, "tests/helpers/wit-owned-receiver-history.mjs"
	, "tests/helpers/wit-owned-receiver-probe.mjs"
	, "tests/helpers/wit-owned-receiver-resource-probe.mjs"
	, "tests/wit-owned-receiver-ci.test.mjs"
	, "tests/wit-owned-receiver-evidence.test.mjs"
	, "tests/wit-owned-receiver-model.test.mjs"
	, "tests/wit-owned-receiver-packaging.test.mjs"
	, "tests/wit-owned-receiver-resource-packaging.test.mjs"
	, "tests/wit-owned-receiver-resource.test.mjs"
	, "tests/wit-owned-receivers.test.mjs"
].sort();
let cached;
export const ownedWitReceiverNormalizationPaths = [...new Set([...ownedWitReceiverChangedPaths, ...ownedJvmReceiverGcNormalizationPaths])].sort();

/**
 * Reverse ordered edits only after authenticating both complete identities.
 *
 * @param source - Complete current source text.
 * @param update - Path, source hashes and reversible replacement spans.
 */
export const reverseOwnedWitReceiverUpdate = (source, update) => {
	assert.ok(ownedWitReceiverChangedPaths.includes(update.path), update.path);
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
	parts.push(source.slice(end)); const prior = parts.join("");
	assert.equal(sha256(prior), update.previousSha256, update.path); return prior;
};

/**
 * Leave unknown edits visible and stop at a requested historical identity.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional stopping digest.
 */
export const beforeOwnedWitReceiver = (path, source, expected) => {
	source = beforeOwnedJvmReceiverGc(path, source, expected);
	if(!ownedWitReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedWitReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedWitReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedWitReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "wit-owned-receivers");
	assert.equal(cached.baselineRevision, ownedWitReceiverBaseline);
	assert.deepEqual(cached.previous, ownedWitReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedWitReceiverChangedPaths);
	const update = cached.updates.find(value => value.path === path);
	return sha256(source) === update.currentSha256 ? reverseOwnedWitReceiverUpdate(source, update) : source;
};

/**
 * Decode registered text paths without changing any unrelated binary input.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedWitReceiverHistoricalBytes = (path, bytes, expected) => ownedWitReceiverNormalizationPaths.includes(path)
	? beforeOwnedWitReceiver(path, bytes.toString("utf8"), expected) : bytes;
