/**
 * Preserve the omitted history-hub transition from the Perl value-index
 * archive-history commit without rewriting its committed ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPerlArchiveHistoryGapPath
	= "docs/evidence/checked-record-value-index-perl-archive-history-gap-source-history-20261020.json";
export const checkedRecordValueIndexPerlArchiveHistoryGapPreviousCommit
	= "3d543b1eb175de2859a2b6485c3d6fa528e83d6a";
export const checkedRecordValueIndexPerlArchiveHistoryGapCurrentCommit
	= "cb2c4d2dc9c6f9f0788a42719babfc8954eb8a6b";
export const checkedRecordValueIndexPerlArchiveHistoryGapHistoricalPaths
	= Object.freeze(["tests/helpers/fin-refinement-source-history.mjs"]);
export const checkedRecordValueIndexPerlArchiveHistoryGapAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-perl-archive-history-gap-source-history.mjs"
		, "tests/helpers/checked-record-value-index-perl-archive-history-gap-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-perl-archive-history-gap-source-history.mjs"
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPerlArchiveHistoryGapPath, "utf8"
));

/**
 * Reverse the exact omitted history-hub transition.
 *
 * @param source - Complete source at the archive-history commit.
 * @param update - Authenticated historical transition.
 */
export const reverseCheckedRecordValueIndexPerlArchiveHistoryGapUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexPerlArchiveHistoryGapHistoricalPaths.includes(
		update.path));
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
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove the exact historical archive-hub layer when its bytes are observed.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPerlArchiveHistoryGapSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPerlArchiveHistoryGapHistoricalPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().historicalTransitions.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseCheckedRecordValueIndexPerlArchiveHistoryGapUpdate(source, update)
		: source;
};
