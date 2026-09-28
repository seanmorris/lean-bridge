/**
 * Preserve earlier receipts across the JVM signature probe's cleanup repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforePhpNixBoundaryRepair, phpNixBoundaryNormalizationPaths } from "./php-nix-boundary-repair-history.mjs";

export const jvmThreadExitRepairBaseline = "86ba0ad47469d0f13dd32d400d2a36b0d8288f95";
export const jvmThreadExitRepairPath = "docs/evidence/jvm-thread-exit-repair-20260928.json";
export const jvmThreadExitRepairPrevious = Object.freeze({
	path: "docs/evidence/owned-wasm32-transport-20260928.json"
	, sha256: "393808a4f571ac4a80aae15ffad26f2913e1a42add5fd0021479eb9cfa813088"
});
export const jvmThreadExitRepairChangedPaths = [
	".github/workflows/consumer-matrix.yml", "docs/contributing/testing.md"
	, "docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
	, "tests/documentation.test.mjs"
	, "tests/fixtures/structured-types/owned-jvm-callback-signatures.java"
	, "tests/helpers/owned-jvm-call-evidence.mjs"
	, "tests/helpers/owned-jvm-installed.mjs"
	, "tests/helpers/owned-php-source-history.mjs"
	, "tests/helpers/owned-wasm32-source-history.mjs"
	, "tests/owned-wasm32-evidence.test.mjs"
].sort();
export const jvmThreadExitRepairAddedPaths = [
	"docs/evidence/jvm-thread-exit-repair-20260928.md"
	, "tests/helpers/jvm-thread-exit-repair-evidence.mjs"
	, "tests/helpers/jvm-thread-exit-repair-history.mjs"
	, "tests/helpers/owned-jvm-thread-exit.mjs"
	, "tests/jvm-thread-exit-repair-evidence.test.mjs"
	, "tests/owned-jvm-thread-exit.test.mjs"
].sort();
let cached;
export const jvmThreadExitNormalizationPaths = [...new Set([...jvmThreadExitRepairChangedPaths, ...phpNixBoundaryNormalizationPaths])].sort();

/**
 * Reverse only authenticated complete sources and ordered literal edits.
 *
 * @param source - Complete current source text.
 * @param update - Recorded current/predecessor identities and exact edits.
 */
export const reverseJvmThreadExitUpdate = (source, update) => {
	assert.ok(jvmThreadExitRepairChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const pieces = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current, update.path);
		pieces.push(source.slice(end, start), previous); end = start + current.length;
	}
	pieces.push(source.slice(end)); const restored = pieces.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path);
	return restored;
};

/**
 * Restore a known predecessor, preserving any unrecorded edits for rejection.
 *
 * @param path - Exact repository-relative path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact identity at which to stop.
 */
export const beforeJvmThreadExitRepair = (path, source, expected) => {
	source = beforePhpNixBoundaryRepair(path, source, expected);
	if(typeof source === "string" && !jvmThreadExitRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !jvmThreadExitRepairChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(jvmThreadExitRepairPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "jvm-thread-exit-repair");
	assert.equal(record.baselineRevision, jvmThreadExitRepairBaseline);
	assert.deepEqual(record.previous, jvmThreadExitRepairPrevious);
	assert.deepEqual(record.updates.map(item => item.path), jvmThreadExitRepairChangedPaths);
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseJvmThreadExitUpdate(source, update) : source;
};

/**
 * Decode only declared text paths; preserve unrelated bytes.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Optional exact predecessor identity.
 */
export const jvmThreadExitHistoricalBytes = (path, bytes, expected) => jvmThreadExitNormalizationPaths.includes(path)
	? beforeJvmThreadExitRepair(path, bytes.toString("utf8"), expected) : bytes;
