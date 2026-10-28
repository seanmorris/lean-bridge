/**
 * Reverse the Core memory bound on the owned JVM package, managed CI, native
 * fork and .NET process verifiers: authenticated inventories are reused, only
 * the current contracts are read, and predecessor receipts are pinned by hash
 * instead of replayed in-process.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const replayChainMemoryHistoryPath
	= "docs/evidence/replay-chain-memory-source-history-20261028.json";
export const replayChainMemoryPredecessor
	= "812fe4fdc8b9c160869d77e201265e2d072a90d9";
export const replayChainMemoryImplementation
	= "bfcac4f5c8c7346503c11b930662c69fb1ac6b5b";
export const replayChainMemoryCommits = Object.freeze([
	"bfcac4f5c8c7346503c11b930662c69fb1ac6b5b"
]);
export const replayChainMemoryChangedPaths = Object.freeze([
	"tests/helpers/managed-ci-isolation-evidence.mjs"
	, "tests/helpers/native-fork-repair-evidence.mjs"
	, "tests/helpers/owned-dotnet-process-evidence.mjs"
	, "tests/helpers/owned-jvm-package-evidence.mjs"
	, "tests/native-fork-repair-evidence.test.mjs"
]);
export const replayChainMemoryNormalizationPaths
	= replayChainMemoryChangedPaths;
export const replayChainMemoryImplementationAddedPaths = Object.freeze([]);
export const replayChainMemoryHistoryAddedPaths = Object.freeze([
	"scripts/update-replay-chain-memory-source-history.mjs"
	, "tests/helpers/replay-chain-memory-source-history-tests.mjs"
	, "tests/helpers/replay-chain-memory-source-history.mjs"
]);
export const replayChainMemoryAddedPaths = Object.freeze([
	...replayChainMemoryImplementationAddedPaths
	, ...replayChainMemoryHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	replayChainMemoryHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseReplayChainMemoryUpdate = (source, update) => {
	assert.ok(replayChainMemoryNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeReplayChainMemorySource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !replayChainMemoryNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseReplayChainMemoryUpdate(source, update);
};
