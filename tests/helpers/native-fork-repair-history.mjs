/**
 * Preserve frozen evidence across the native fork-status regression repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const nativeForkRepairBaseline = "6e73096a2e309bca71106924a5276e0a2ddb0c8c";
export const nativeForkRepairPath = "docs/evidence/native-fork-repair-20260927.json";
export const nativeForkRepairChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/native-recursive-callable-calls-probe.mjs"
	, "tests/helpers/owned-dotnet-process-evidence.mjs"
	, "tests/helpers/owned-dotnet-process-history.mjs"
	, "tests/helpers/owned-dotnet-source-history.mjs"
	, "tests/native-recursive-callable-compile.test.mjs"
	, "tests/owned-dotnet-process-evidence.test.mjs"
].sort();
export const nativeForkRepairAddedPaths = [
	"docs/evidence/native-fork-repair-20260927.md"
	, "tests/helpers/native-fork-repair-evidence.mjs"
	, "tests/helpers/native-fork-repair-history.mjs"
	, "tests/native-fork-repair-evidence.test.mjs"
].sort();
let cached;
const record = () => cached ??= JSON.parse(readFileSync(nativeForkRepairPath, "utf8"));

/**
 * Reverse only recorded edits authenticated by both complete file hashes.
 *
 * @param source - Complete current text.
 * @param update - Exact predecessor identities and ordered literal edits.
 */
export const reverseNativeForkRepair = (source, update) => {
	assert.ok(nativeForkRepairChangedPaths.includes(update.path), update.path);
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
 * Preserve unknown content and stop at an explicitly requested identity.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional requested identity.
 */
export const beforeNativeForkRepair = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !nativeForkRepairChangedPaths.includes(path)) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeForkRepair(source, update) : source;
};

/**
 * Decode only recorded source paths and preserve all other bytes.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Optional requested identity.
 */
export const nativeForkRepairHistoricalBytes = (path, bytes, expected) => nativeForkRepairChangedPaths.includes(path)
	? beforeNativeForkRepair(path, bytes.toString("utf8"), expected) : bytes;
