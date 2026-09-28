/**
 * Preserve the frozen NuGet milestone across process-origin hardening.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeNativeForkRepair, nativeForkRepairNormalizationPaths } from "./native-fork-repair-history.mjs";

export const ownedDotnetProcessBaseline = "02d067429ab3b2b72d38270ea9c491c81017fe2f";
export const ownedDotnetProcessPath = "docs/evidence/owned-dotnet-process-20260927.json";
export const ownedDotnetProcessChangedPaths = [
	"docs/consume/dotnet.md", "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/dotnet/verified-assets.mjs"
	, "tests/helpers/dotnet-structured-callable-regression.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-ci-source-history.mjs"
	, "tests/helpers/owned-cpp-order-history.mjs"
	, "tests/helpers/owned-dotnet-evidence.mjs"
	, "tests/helpers/owned-dotnet-source-history.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/helpers/owned-ruby-source-history.mjs"
	, "tests/helpers/owned-rust-evidence.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/owned-c-packaging.test.mjs"
	, "tests/owned-dotnet-coexistence.test.mjs"
	, "tests/owned-dotnet-evidence.test.mjs"
	, "tests/owned-dotnet-loading-evidence.test.mjs"
].sort();
export const ownedDotnetProcessNormalizationPaths = [...new Set([...ownedDotnetProcessChangedPaths, ...nativeForkRepairNormalizationPaths])].sort();
export const ownedDotnetProcessAddedPaths = [
	"docs/evidence/owned-dotnet-process-20260927.md"
	, "tests/fixtures/structured-types/owned-dotnet-cold.c"
	, "tests/fixtures/structured-types/owned-dotnet-cold.cs"
	, "tests/helpers/owned-dotnet-cold.mjs"
	, "tests/helpers/owned-dotnet-process-evidence.mjs"
	, "tests/helpers/owned-dotnet-process-history.mjs"
	, "tests/owned-dotnet-process-evidence.test.mjs"
].sort();
let cached;
const record = () => cached ??= JSON.parse(readFileSync(ownedDotnetProcessPath, "utf8"));

/**
 * Reverse recorded literal edits only after authenticating both whole texts.
 *
 * @param source - Complete current source or generated text.
 * @param update - Path, full digests and ordered literal edits.
 */
export const reverseOwnedDotnetProcess = (source, update) => {
	source = beforeNativeForkRepair(update.path, source, update.currentSha256);
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
 * Restore exactly recorded repository predecessors, not arbitrary new edits.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact identity at which restoration stops.
 */
export const beforeOwnedDotnetProcess = (path, source, expected) => {
	source = beforeNativeForkRepair(path, source, expected);
	if(typeof source === "string" && !ownedDotnetProcessChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedDotnetProcessChangedPaths.includes(path)) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedDotnetProcess(source, update) : source;
};

/**
 * Decode only the declared source paths; preserve all other bytes unchanged.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Requested historical identity.
 */
export const ownedDotnetProcessHistoricalBytes = (path, bytes, expected) => ownedDotnetProcessNormalizationPaths.includes(path)
	? beforeOwnedDotnetProcess(path, bytes.toString("utf8"), expected) : bytes;

/**
 * Reconstruct an old generated C# file through a whole-file-authenticated edit.
 *
 * @param path - Generated package-relative filename.
 * @param source - Complete current generated text.
 * @param expected - Exact identity stored in the immutable earlier receipt.
 */
export const beforeOwnedDotnetProcessGenerated = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().generatedUpdates.find(item => item.path === path
		&& item.currentSha256 === digest && item.previousSha256 === expected);
	return update ? reverseOwnedDotnetProcess(source, update) : source;
};
