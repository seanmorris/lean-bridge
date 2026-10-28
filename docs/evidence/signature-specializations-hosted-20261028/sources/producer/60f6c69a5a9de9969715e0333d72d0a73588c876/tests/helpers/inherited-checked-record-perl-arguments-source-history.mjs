/**
 * Authenticate the hosted Perl combined-argument correction as one exact,
 * reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordPerlArgumentsHistoryPath
	= "docs/evidence/inherited-checked-record-perl-arguments-source-history-20261018.json";
export const inheritedCheckedRecordPerlArgumentsPredecessor
	= "16a722de655f2d6b691b9c0e26d1ad945337445a";
export const inheritedCheckedRecordPerlArgumentsDraftParent
	= "3060a86f246662ba16b43874ac6a9ec436f3a513";
export const inheritedCheckedRecordPerlArgumentsChangedPaths = Object.freeze([
	"tests/fixtures/inherited-checked-record-consumers/perl.pl"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/inherited-checked-record-perl-fixture-tests.mjs"
	, "tests/inherited-checked-record-perl-source-history.test.mjs"
]);
export const inheritedCheckedRecordPerlArgumentsAddedPaths = Object.freeze([
	"scripts/update-inherited-checked-record-perl-arguments-source-history.mjs"
	, "tests/helpers/inherited-checked-record-perl-arguments-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordPerlArgumentsHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted Perl combined-argument transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordPerlArgumentsUpdate = (
	source, update
) => {
	assert.ok(inheritedCheckedRecordPerlArgumentsChangedPaths.includes(
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
export const beforeInheritedCheckedRecordPerlArgumentsSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordPerlArgumentsChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordPerlArgumentsUpdate(source, update)
		: source;
};
