/**
 * Close omitted matrix/browser history-hub and Rust expectation transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexMatrixHistoryGapPath
	= "docs/evidence/checked-record-value-index-matrix-history-gap-source-history-20261020.json";
export const checkedRecordValueIndexMatrixHistoryGapPredecessor
	= "13eaf45d4b1909b9cecf5278c050bd67b51ebbe7";
export const checkedRecordValueIndexMatrixHistoryGapDraftParent
	= checkedRecordValueIndexMatrixHistoryGapPredecessor;
export const checkedRecordValueIndexMatrixHistoryGapChangedPaths
	= Object.freeze(["tests/helpers/fin-refinement-source-history.mjs"]);
export const checkedRecordValueIndexMatrixHistoryGapHistoricalPaths
	= Object.freeze([
		"tests/type-surface.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexMatrixHistoryGapAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-matrix-history-gap-source-history.mjs"
		, "tests/helpers/checked-record-value-index-matrix-history-gap-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-history-gap-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexMatrixHistoryGapPath, "utf8"
));

const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
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
 * Reverse the live matrix history-hub update.
 *
 * @param source - Current source text.
 * @param update - Reversible update record.
 */
export const reverseCheckedRecordValueIndexMatrixHistoryGapUpdate = (
	source, update
) => reverse(source, update, checkedRecordValueIndexMatrixHistoryGapChangedPaths);

/**
 * Reverse one omitted historical matrix-adjacent update.
 *
 * @param source - Current source text.
 * @param update - Reversible update record.
 */
export const reverseCheckedRecordValueIndexMatrixHistoricalGapUpdate = (
	source, update
) => reverse(source, update
	, checkedRecordValueIndexMatrixHistoryGapHistoricalPaths);

/**
 * Reconstruct across the live hub wiring and every omitted historical edge.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Expected historical digest.
 */
export const beforeCheckedRecordValueIndexMatrixHistoryGapSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	if(checkedRecordValueIndexMatrixHistoryGapChangedPaths.includes(path))
	{
		const update = record().updates.find(item => item.path === path);
		if(update?.currentSha256 === digest)
		{
			source = reverseCheckedRecordValueIndexMatrixHistoryGapUpdate(
				source, update
			);
			digest = sha256(source);
			if(digest === expected) return source;
		}
	}
	if(!checkedRecordValueIndexMatrixHistoryGapHistoricalPaths.includes(path))
		return source;
	while(true)
	{
		const update = record().historicalTransitions.find(item =>
			item.path === path && item.currentSha256 === digest
		);
		if(!update) return source;
		source = reverseCheckedRecordValueIndexMatrixHistoricalGapUpdate(
			source, update
		);
		digest = sha256(source);
		if(digest === expected) return source;
	}
};
