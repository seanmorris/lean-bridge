/**
 * Reverse the central-hub and Core-partition registration of the independently
 * authenticated replay-chain memory bound.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const replayChainMemoryIntegrationHistoryPath
	= "docs/evidence/replay-chain-memory-integration-source-history-20261028.json";
export const replayChainMemoryIntegrationBase
	= "9fd749f78048fe70b3581ec00848e1461b3b16bf";
export const replayChainMemoryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const replayChainMemoryIntegrationNormalizationPaths
	= replayChainMemoryIntegrationPaths;
export const replayChainMemoryIntegrationAddedPaths = Object.freeze([
	"scripts/update-replay-chain-memory-integration-source-history.mjs"
	, "tests/helpers/replay-chain-memory-integration-source-history-tests.mjs"
	, "tests/helpers/replay-chain-memory-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	replayChainMemoryIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseReplayChainMemoryIntegrationUpdate = (source, update) => {
	assert.ok(replayChainMemoryIntegrationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this integration layer, stopping at an optional exact digest.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source text.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeReplayChainMemoryIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !replayChainMemoryIntegrationPaths.includes(path)) return source;
	if(sha256(source) === expected) return source;
	const update = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return update === undefined ? source
		: reverseReplayChainMemoryIntegrationUpdate(source, update);
};
