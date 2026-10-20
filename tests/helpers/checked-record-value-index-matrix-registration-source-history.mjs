/**
 * Preserve the exact contract-profile registration for matrix tests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexMatrixRegistrationHistoryPath
	= "docs/evidence/checked-record-value-index-matrix-registration-source-history-20261020.json";
export const checkedRecordValueIndexMatrixRegistrationPredecessor
	= "d8f87b3743790d99b1238cb0b78a4cfc8d9b8bf1";
export const checkedRecordValueIndexMatrixRegistrationDraftParent
	= "c4f81e11ae8816b2b5239a01cd2695ffd641485b";
export const checkedRecordValueIndexMatrixRegistrationFoundationModifiedPaths
	= Object.freeze([
		"src/adoption/test-profiles.mjs", "tests/test-profiles.test.mjs"
	]);
export const checkedRecordValueIndexMatrixRegistrationFoundationAddedPaths
	= Object.freeze([]);
export const checkedRecordValueIndexMatrixRegistrationChangedPaths
	= checkedRecordValueIndexMatrixRegistrationFoundationModifiedPaths;
export const checkedRecordValueIndexMatrixRegistrationHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-matrix-registration-source-history.mjs"
		, "tests/helpers/checked-record-value-index-matrix-registration-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-registration-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexMatrixRegistrationHistoryPath, "utf8"
));

/**
 * Reverse one exact matrix test registration update.
 *
 * @param source - Current source text.
 * @param update - Reversible update record.
 */
export const reverseCheckedRecordValueIndexMatrixRegistrationUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexMatrixRegistrationChangedPaths.includes(
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
 * Remove only the exact matrix test registration layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Expected historical digest.
 */
export const beforeCheckedRecordValueIndexMatrixRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexMatrixRegistrationChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexMatrixRegistrationUpdate(source, update)
		: source;
};
