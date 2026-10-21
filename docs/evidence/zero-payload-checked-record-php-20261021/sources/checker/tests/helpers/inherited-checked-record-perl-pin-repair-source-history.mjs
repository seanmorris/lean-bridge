/**
 * Authenticate the inherited checked-record Perl type-surface pin repair as
 * one exact, reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordPerlPinRepairHistoryPath
	= "docs/evidence/inherited-checked-record-perl-pin-repair-source-history-20261018.json";
export const inheritedCheckedRecordPerlPinRepairPredecessor
	= "61d7f67ff206dd92542b063063bed52f48c6912d";
export const inheritedCheckedRecordPerlPinRepairDraftParent
	= "61d7f67ff206dd92542b063063bed52f48c6912d";
export const inheritedCheckedRecordPerlPinRepairPreviousTestProfilesSha256
	= "2059175f56608704a7efd90bb6bec02da2e0bd3b0cb0918a5e33362348699541";
export const inheritedCheckedRecordPerlPinRepairCurrentTestProfilesSha256
	= "f339b9da5bc2ad926d86ec1e362c0e93bbbca83be09c26d6fe90e020cddf38b5";
export const inheritedCheckedRecordPerlPinRepairPins = Object.freeze([
	Object.freeze({
		path: "src/adoption/test-profiles.mjs"
		, previousSha256:
			inheritedCheckedRecordPerlPinRepairPreviousTestProfilesSha256
		, currentSha256:
			inheritedCheckedRecordPerlPinRepairCurrentTestProfilesSha256
		, count: 94
	})
]);
export const inheritedCheckedRecordPerlPinRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/inherited-checked-record-perl-source-history.test.mjs"
]);
export const inheritedCheckedRecordPerlPinRepairAddedPaths = Object.freeze([
	"scripts/update-inherited-checked-record-perl-pin-repair-source-history.mjs"
	, "tests/helpers/inherited-checked-record-perl-pin-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordPerlPinRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record Perl pin-repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordPerlPinRepairUpdate = (
	source, update
) => {
	assert.ok(inheritedCheckedRecordPerlPinRepairChangedPaths.includes(
		update.path
	));
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.replacements !== undefined)
	{
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		for(const replacement of [...update.replacements].reverse())
		{
			assert.deepEqual(Object.keys(replacement).sort()
				, ["count", "current", "previous"]);
			assert.equal(typeof replacement.previous, "string");
			assert.equal(typeof replacement.current, "string");
			assert.notEqual(replacement.previous, replacement.current);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.current).length - 1
				, replacement.count, update.path);
			source = source.replaceAll(
				replacement.current, replacement.previous
			);
		}
		assert.equal(sha256(source), update.previousSha256, update.path);
		return source;
	}
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
 * Remove only this pin-repair layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordPerlPinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordPerlPinRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordPerlPinRepairUpdate(source, update)
		: source;
};
