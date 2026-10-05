/**
 * Preserve exact predecessor sources across optimized JVM lifetime acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeCopiedFixtureReaders, copiedFixtureReaderPaths } from "./copied-fixture-source-history.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedJvmReceiverGcPath = "docs/evidence/owned-jvm-receiver-gc-20261001.json";
export const ownedJvmReceiverGcBaseline = "2ce50a51702a6510821197c0476eb95b08a0e359";
export const ownedJvmReceiverGcPrevious = Object.freeze({
	path: "docs/evidence/wit-owned-receivers-20261001.json"
	, sha256: "d8621ed8b0744f9a9ac9bb5ddb1da200b3f7b85f5bab801a54c248e4b36e0262"
});
export const ownedJvmReceiverGcChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-javascript-receiver-history.mjs"
	, "tests/helpers/wit-owned-receiver-history.mjs"
	, "tests/wit-owned-receiver-evidence.test.mjs"
].sort();
export const ownedJvmReceiverGcAddedPaths = [
	"docs/evidence/owned-jvm-receiver-gc-20261001.md"
	, "tests/fixtures/structured-types/owned-jvm-receiver-gc.java"
	, "tests/fixtures/structured-types/owned-kotlin-receiver-gc.kt"
	, "tests/helpers/owned-jvm-receiver-gc-ci.mjs"
	, "tests/helpers/owned-jvm-receiver-gc-evidence.mjs"
	, "tests/helpers/owned-jvm-receiver-gc-history.mjs"
	, "tests/owned-jvm-receiver-gc-ci.test.mjs"
	, "tests/owned-jvm-receiver-gc-evidence.test.mjs"
	, "tests/owned-jvm-receiver-gc.test.mjs"
].sort();
let cached;
export const ownedJvmReceiverGcNormalizationPaths = [...new Set([...ownedJvmReceiverGcChangedPaths, ...copiedFixtureReaderPaths])].sort();

/**
 * Reverse ordered edits only after authenticating complete source identities.
 *
 * @param source - Complete current source text.
 * @param update - Path, identities and reversible replacement spans.
 */
export const reverseOwnedJvmReceiverGcUpdate = (source, update) => {
	assert.ok(ownedJvmReceiverGcChangedPaths.includes(update.path), update.path);
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
 * Stop at requested identities and leave every unrecorded change visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional stopping digest.
 */
export const beforeOwnedJvmReceiverGc = (path, source, expected) => {
	source = beforeCopiedFixtureReaders(path, source, expected);
	if(!ownedJvmReceiverGcChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedJvmReceiverGcPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedJvmReceiverGcBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedJvmReceiverGcPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-jvm-receiver-gc");
	assert.equal(cached.baselineRevision, ownedJvmReceiverGcBaseline);
	assert.deepEqual(cached.previous, ownedJvmReceiverGcPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedJvmReceiverGcChangedPaths);
	const update = cached.updates.find(value => value.path === path);
	return sha256(source) === update.currentSha256 ? reverseOwnedJvmReceiverGcUpdate(source, update) : source;
};

/**
 * Decode registered source paths without changing unrelated binary inputs.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedJvmReceiverGcHistoricalBytes = (path, bytes, expected) => ownedJvmReceiverGcNormalizationPaths.includes(path)
	? beforeOwnedJvmReceiverGc(path, bytes.toString("utf8"), expected) : bytes;
