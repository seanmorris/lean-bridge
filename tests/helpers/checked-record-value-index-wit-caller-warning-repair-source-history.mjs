/**
 * Authenticate the result-only WIT caller warning repair and its source-history
 * registration as one exact, reversible layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexWitCallerWarningRepairHistoryPath
	= "docs/evidence/checked-record-value-index-wit-caller-warning-repair-source-history-20261020.json";
export const checkedRecordValueIndexWitCallerWarningRepairPreviousCommit
	= "7f4e95965cfb66e3ca44b276ca0f0b7c823cd2d6";
export const checkedRecordValueIndexWitCallerWarningRepairCurrentCommit
	= "ac17ed03d7071151ce3b232fb7dd5cf3b78119ae";
export const checkedRecordValueIndexWitCallerWarningRepairRegistrationParent
	= "45d13fb3eea6f041998d659a3b96eb5109363321";
export const checkedRecordValueIndexWitCallerWarningRepairHistoricalPaths
	= Object.freeze([
		"tests/fixtures/checked-record-value-index-wit/wit-wasi.c"
	]);
export const checkedRecordValueIndexWitCallerWarningRepairRegistrationPaths
	= Object.freeze([
		"tests/checked-record-value-index-wit.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexWitCallerWarningRepairChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexWitCallerWarningRepairRegistrationPaths
		, ...checkedRecordValueIndexWitCallerWarningRepairHistoricalPaths
	]);
export const checkedRecordValueIndexWitCallerWarningRepairAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-wit-caller-warning-repair-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-wit-caller-warning-repair-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexWitCallerWarningRepairHistoryPath, "utf8"
));

/**
 * Reverse one authenticated warning-repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition for the same path.
 */
export const reverseCheckedRecordValueIndexWitCallerWarningRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexWitCallerWarningRepairChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		assert.notEqual(edit.previous, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact result-only caller warning repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexWitCallerWarningRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexWitCallerWarningRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseCheckedRecordValueIndexWitCallerWarningRepairUpdate(source, update)
		: source;
};
