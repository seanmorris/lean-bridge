/**
 * Preserve the exact hosted-checkout correction for the value-index matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexMatrixCheckoutHistoryPath
	= "docs/evidence/checked-record-value-index-matrix-checkout-source-history-20261020.json";
export const checkedRecordValueIndexMatrixCheckoutPredecessor
	= "6feb79010a9d96ec7462123f02295782d42693db";
export const checkedRecordValueIndexMatrixCheckoutDraftParent
	= "8681daba4d4dc83e527bf2091fa8c4d2cd9361d0";
export const checkedRecordValueIndexMatrixCheckoutFoundationModifiedPaths
	= Object.freeze([
		".github/workflows/checked-record-value-index-matrix.yml"
		, "tests/helpers/checked-record-value-index-matrix-promotion-source-history-tests.mjs"
	]);
export const checkedRecordValueIndexMatrixCheckoutFoundationAddedPaths
	= Object.freeze([]);
export const checkedRecordValueIndexMatrixCheckoutChangedPaths
	= checkedRecordValueIndexMatrixCheckoutFoundationModifiedPaths;
export const checkedRecordValueIndexMatrixCheckoutHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-matrix-checkout-source-history.mjs"
		, "tests/helpers/checked-record-value-index-matrix-checkout-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-checkout-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexMatrixCheckoutHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted-checkout repair.
 *
 * @param source - Current source text.
 * @param update - Reversible update record.
 */
export const reverseCheckedRecordValueIndexMatrixCheckoutUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexMatrixCheckoutChangedPaths.includes(
		update.path));
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
 * Remove only the exact hosted-checkout repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Expected historical digest.
 */
export const beforeCheckedRecordValueIndexMatrixCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexMatrixCheckoutChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexMatrixCheckoutUpdate(source, update)
		: source;
};
