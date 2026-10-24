/**
 * Restore the two Ruby transfer-copy test transitions from 3c22d43 that the
 * owned replay gap record omitted. The record carries that commit's three
 * source transitions; these are its packaging and transfer tests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const rubyTransferCopyGapHistoryPath
	= "docs/evidence/ruby-transfer-copy-gap-source-history-20261024.json";
export const rubyTransferCopyGapPredecessor
	= "2014af9bf78714f0d5a5c0eb9a5ce724d7a1778e";
export const rubyTransferCopyGapHistoricalPredecessor
	= "18804049b371cfe17eaec867c0365fb4b47b8152";
export const rubyTransferCopyGapHistoricalCommit
	= "3c22d43fa73c646b9a2472e4b6aada674c0a564e";
// The owned replay gap record already carries the other three paths of this commit.
export const rubyTransferCopyGapHistoricalPaths = Object.freeze([
	"tests/owned-ruby-transfer-packaging.test.mjs"
	, "tests/owned-ruby-transfers.test.mjs"
]);
export const rubyTransferCopyGapNormalizationPaths
	= rubyTransferCopyGapHistoricalPaths;
export const rubyTransferCopyGapAddedPaths = Object.freeze([
	"scripts/update-ruby-transfer-copy-gap-source-history.mjs"
	, "tests/helpers/ruby-transfer-copy-gap-source-history-tests.mjs"
	, "tests/helpers/ruby-transfer-copy-gap-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	rubyTransferCopyGapHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseRubyTransferCopyGapUpdate = (source, update) => {
	assert.ok(rubyTransferCopyGapNormalizationPaths.includes(update.path));
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
 * Remove one recognized omitted historical transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeRubyTransferCopyGapSource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !rubyTransferCopyGapNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	const update = record().historicalTransitions
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseRubyTransferCopyGapUpdate(source, update);
};
