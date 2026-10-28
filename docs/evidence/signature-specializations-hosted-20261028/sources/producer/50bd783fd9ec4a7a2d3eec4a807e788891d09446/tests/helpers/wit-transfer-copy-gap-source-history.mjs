/**
 * Restore the six transfer-copy transitions from 1b77979 that the owned
 * replay gap record omitted: the WIT owned package and artifacts plus the
 * four host transfer tests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const witTransferCopyGapHistoryPath
	= "docs/evidence/wit-transfer-copy-gap-source-history-20261024.json";
export const witTransferCopyGapPredecessor
	= "3298c7461ce704c058d6eadf98871a3db1b61680";
export const witTransferCopyGapHistoricalPredecessor
	= "cf5062772b63ee7483d0a30c2f9df3c01d358157";
export const witTransferCopyGapHistoricalCommit
	= "1b77979abe846c67f5b3b19693012ed0a238f8ea";
// The owned replay gap record already carries the other nine paths of this commit.
export const witTransferCopyGapHistoricalPaths = Object.freeze([
	"src/backends/wit/owned-package.mjs"
	, "src/build/owned-wit-artifacts.mjs"
	, "tests/owned-dotnet-transfers.test.mjs"
	, "tests/owned-jvm-transfers.test.mjs"
	, "tests/owned-php-transfers.test.mjs"
	, "tests/wit-owned-transfers.test.mjs"
]);
export const witTransferCopyGapIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const witTransferCopyGapNormalizationPaths = Object.freeze([
	...new Set([
		...witTransferCopyGapHistoricalPaths
		, ...witTransferCopyGapIntegrationPaths
	])
]);
export const witTransferCopyGapAddedPaths = Object.freeze([
	"scripts/update-wit-transfer-copy-gap-source-history.mjs"
	, "tests/helpers/wit-transfer-copy-gap-source-history-tests.mjs"
	, "tests/helpers/wit-transfer-copy-gap-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	witTransferCopyGapHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseWitTransferCopyGapUpdate = (source, update) => {
	assert.ok(witTransferCopyGapNormalizationPaths.includes(update.path));
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
 * Remove one recognized integration or omitted historical transition. The
 * central hub owns stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeWitTransferCopyGapSource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !witTransferCopyGapNormalizationPaths.includes(path))
		return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.historicalTransitions]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseWitTransferCopyGapUpdate(source, update);
};
