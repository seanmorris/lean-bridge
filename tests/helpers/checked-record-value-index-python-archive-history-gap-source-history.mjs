/**
 * Preserve the omitted history-hub transition from the Python value-index
 * archive-history commit without rewriting its committed ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPythonArchiveHistoryGapPath
	= "docs/evidence/checked-record-value-index-python-archive-history-gap-source-history-20261020.json";
export const checkedRecordValueIndexPythonArchiveHistoryGapPreviousCommit
	= "6f90d9e54c38d5e06cad98dfb1d2afbb58b0cdb1";
export const checkedRecordValueIndexPythonArchiveHistoryGapCurrentCommit
	= "96f80a2acbe1214a6888a4b700d04bb97cf480eb";
export const checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths
	= Object.freeze(["tests/helpers/fin-refinement-source-history.mjs"]);
export const checkedRecordValueIndexPythonArchiveHistoryGapAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-python-archive-history-gap-source-history.mjs"
		, "tests/helpers/checked-record-value-index-python-archive-history-gap-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-python-archive-history-gap-source-history.mjs"
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPythonArchiveHistoryGapPath, "utf8"
));

/**
 * Reverse the exact omitted Python archive history-hub transition.
 *
 * @param source - Complete source at the archive-history commit.
 * @param update - Authenticated historical transition.
 */
export const reverseCheckedRecordValueIndexPythonArchiveHistoryGapUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths
		.includes(update.path));
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
 * Remove the exact historical Python archive-hub layer when its bytes appear.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPythonArchiveHistoryGapSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().historicalTransitions.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseCheckedRecordValueIndexPythonArchiveHistoryGapUpdate(
			source, update)
		: source;
};
