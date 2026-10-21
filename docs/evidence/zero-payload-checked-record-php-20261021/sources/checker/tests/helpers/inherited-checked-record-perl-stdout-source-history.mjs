/**
 * Authenticate the hosted Perl stdout-verifier correction as one exact,
 * reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordPerlStdoutHistoryPath
	= "docs/evidence/inherited-checked-record-perl-stdout-source-history-20261018.json";
export const inheritedCheckedRecordPerlStdoutPredecessor
	= "b4260c9df3508dbfa49849524d8d351e8ddc8b7b";
export const inheritedCheckedRecordPerlStdoutDraftParent
	= "6b7ec0fca6e8ec4cd3a0ef97e8d681e883057ea6";
export const inheritedCheckedRecordPerlStdoutChangedPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/inherited-checked-record-perl-ci-report-tests.mjs"
	, "tests/helpers/inherited-checked-record-perl-records.mjs"
	, "tests/inherited-checked-record-perl-source-history.test.mjs"
]);
export const inheritedCheckedRecordPerlStdoutAddedPaths = Object.freeze([
	"scripts/update-inherited-checked-record-perl-stdout-source-history.mjs"
	, "tests/helpers/inherited-checked-record-perl-stdout-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordPerlStdoutHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted Perl stdout-verifier transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordPerlStdoutUpdate = (
	source, update
) => {
	assert.ok(inheritedCheckedRecordPerlStdoutChangedPaths.includes(
		update.path
	));
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
 * Remove only this correction from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordPerlStdoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordPerlStdoutChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordPerlStdoutUpdate(source, update)
		: source;
};
