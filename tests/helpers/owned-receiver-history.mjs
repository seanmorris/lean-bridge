/**
 * Authenticate exact predecessor sources across C receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedCppReceiver, ownedCppReceiverNormalizationPaths } from "./owned-cpp-receiver-history.mjs";

export const ownedReceiverPath = "docs/evidence/owned-receivers-20261001.json";
export const ownedReceiverBaseline = "1e6f7f5f5f916461dae4a567916db3dc6d4cfa6d";
export const ownedReceiverPrevious = Object.freeze({
	path: "docs/evidence/wit-owned-borrows-20261001.json"
	, sha256: "1cbcf73fbad42679441371ff5448379c0513dab5ba17892095dbaa37efef2e01"
});
export const ownedReceiverChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/c.md", "docs/contributing/testing.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/publish/c.md", "docs/type-surface.v1.json", "package.json"
	, "schema/lean-export-configuration.schema.json"
	, "src/abi/owned-aggregate-model.mjs"
	, "src/adoption/test-profiles.mjs", "src/analyze/NativeExports.lean"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/reviewed-owned-source.mjs", "src/analyze/semantic-model.mjs"
	, "src/backends/c/owned-package.mjs", "src/backends/c/owned-values.mjs"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/backends/native/owned-value-layout.mjs"
	, "src/build/native-artifacts.mjs", "src/build/native-c-projection.mjs"
	, "src/build/native-component.mjs", "src/build/native-graph-model.mjs"
	, "src/build/native-project.mjs", "src/build/owned-aggregate-carriers.mjs"
	, "src/build/owned-c-projection.mjs", "src/build/owned-native-model.mjs"
	, "src/release/owned-c-package.mjs"
	, "tests/helpers/owned-borrow-ci-evidence.mjs"
	, "tests/helpers/owned-cpp-borrow-evidence.mjs"
	, "tests/helpers/owned-rust-borrow-evidence.mjs"
	, "tests/helpers/owned-python-borrow-evidence.mjs"
	, "tests/helpers/owned-ruby-borrow-evidence.mjs"
	, "tests/helpers/owned-dotnet-borrow-evidence.mjs"
	, "tests/helpers/owned-jvm-borrow-evidence.mjs"
	, "tests/helpers/owned-perl-borrow-evidence.mjs"
	, "tests/helpers/owned-php-borrow-evidence.mjs"
	, "tests/helpers/owned-php-wasm-borrow-evidence.mjs"
	, "tests/helpers/owned-javascript-borrow-history.mjs"
	, "tests/helpers/wit-owned-borrow-evidence.mjs"
	, "tests/helpers/wit-owned-borrow-history.mjs"
	, "tests/wit-owned-borrow-evidence.test.mjs"
	, "tests/documentation.test.mjs"
].sort();
export const ownedReceiverAddedPaths = [
	"docs/evidence/owned-receivers-20261001.md"
	, "tests/fixtures/structured-types/owned-receiver-parameter.c"
	, "tests/fixtures/structured-types/owned-receiver-plain.c"
	, "tests/helpers/owned-receiver-ci.mjs"
	, "tests/helpers/owned-receiver-evidence.mjs"
	, "tests/helpers/owned-receiver-fixture.mjs"
	, "tests/helpers/owned-receiver-history.mjs"
	, "tests/helpers/owned-receiver-mutants.mjs"
	, "tests/owned-receiver-analysis.test.mjs"
	, "tests/owned-receiver-evidence.test.mjs"
	, "tests/owned-receiver-packaging.test.mjs"
	, "tests/owned-receiver-plain.test.mjs"
].sort();
let cached;
export const ownedReceiverNormalizationPaths = [...new Set([...ownedReceiverChangedPaths, ...ownedCppReceiverNormalizationPaths])].sort();

/**
 * Reverse registered edit spans after checking both complete source identities.
 *
 * @param source - Complete current text.
 * @param update - Authenticated path, identities and replacement spans.
 */
export const reverseOwnedReceiverUpdate = (source, update) => {
	assert.ok(ownedReceiverChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedReceiver = (path, source, expected) => {
	source = beforeOwnedCppReceiver(path, source, expected);
	if(!ownedReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-receivers");
	assert.equal(cached.baselineRevision, ownedReceiverBaseline);
	assert.deepEqual(cached.previous, ownedReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedReceiverChangedPaths);
	const update = cached.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedReceiverUpdate(source, update) : source;
};

/**
 * Preserve binary inputs and decode only the registered text paths.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedReceiverHistoricalBytes = (path, bytes, expected) => ownedReceiverNormalizationPaths.includes(path)
	? beforeOwnedReceiver(path, bytes.toString("utf8"), expected) : bytes;
