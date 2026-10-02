/**
 * Preserve immutable source evidence across managed CI job isolation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedJvmPackages, ownedJvmChangedPaths } from "./owned-jvm-source-history.mjs";

export const managedCiIsolationBaseline = "733bd5a289841309c3ed0b6a99e322cdcb361a09";
export const managedCiIsolationPath = "docs/evidence/managed-ci-isolation-20260927.json";
export const managedCiIsolationChangedPaths = [
	".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/native-fork-repair-evidence.mjs"
	, "tests/helpers/native-fork-repair-history.mjs"
	, "tests/helpers/owned-dotnet-process-history.mjs"
	, "tests/native-fork-repair-evidence.test.mjs"
].sort();
export const managedCiIsolationNormalizationPaths = [...new Set([...managedCiIsolationChangedPaths, ...ownedJvmChangedPaths])].sort();
export const managedCiIsolationAddedPaths = [
	"docs/evidence/managed-ci-isolation-20260927.md"
	, "tests/helpers/managed-ci-isolation.mjs"
	, "tests/helpers/managed-ci-isolation-history.mjs"
	, "tests/helpers/managed-ci-isolation-evidence.mjs"
	, "tests/managed-ci-isolation.test.mjs"
	, "tests/managed-ci-isolation-evidence.test.mjs"
].sort();
let cached;
const record = () => cached ??= JSON.parse(readFileSync(managedCiIsolationPath, "utf8"));

/**
 * Reverse recorded literal edits only after authenticating both complete files.
 *
 * @param source - Complete current text.
 * @param update - Exact hashes and ordered literal edits.
 */
export const reverseManagedCiIsolation = (source, update) => {
	source = beforeOwnedJvmPackages(update.path, source, update.currentSha256);
	assert.ok(managedCiIsolationChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const chunks = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current);
		chunks.push(source.slice(end, start), previous); end = start + current.length;
	}
	chunks.push(source.slice(end)); const restored = chunks.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path);
	return restored;
};

/**
 * Leave unknown content and explicitly requested identities unchanged.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional requested identity.
 */
export const beforeManagedCiIsolation = (path, source, expected) => {
	source = beforeOwnedJvmPackages(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !managedCiIsolationChangedPaths.includes(path)) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseManagedCiIsolation(source, update) : source;
};

/**
 * Normalize declared text paths only, preserving unrelated binary bytes.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Optional requested identity.
 */
export const managedCiIsolationHistoricalBytes = (path, bytes, expected) => managedCiIsolationNormalizationPaths.includes(path)
	? beforeManagedCiIsolation(path, bytes.toString("utf8"), expected) : bytes;
