/**
 * Authenticate the inherited checked-record PHP type-surface pin repair as
 * one exact, reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordPhpPinRepairHistoryPath
	= "docs/evidence/inherited-checked-record-php-pin-repair-source-history-20261018.json";
export const inheritedCheckedRecordPhpPinRepairPredecessor
	= "de9d1316c340a39de8d608475689526b176d9df5";
export const inheritedCheckedRecordPhpPinRepairDraftParent
	= "de9d1316c340a39de8d608475689526b176d9df5";
export const inheritedCheckedRecordPhpPinRepairPreviousTestProfilesSha256
	= "0af21710b4dc282aed01dc2bfa78155fd203301e56cc8f26b8435734e7bb2265";
export const inheritedCheckedRecordPhpPinRepairCurrentTestProfilesSha256
	= "2059175f56608704a7efd90bb6bec02da2e0bd3b0cb0918a5e33362348699541";
export const inheritedCheckedRecordPhpPinRepairPins = Object.freeze([
	Object.freeze({
		path: "src/adoption/test-profiles.mjs"
		, previousSha256:
			inheritedCheckedRecordPhpPinRepairPreviousTestProfilesSha256
		, currentSha256:
			inheritedCheckedRecordPhpPinRepairCurrentTestProfilesSha256
		, count: 94
	})
	, Object.freeze({
		path: "src/backends/php/copied-model.mjs"
		, previousSha256:
			"92250b77404eb0ae0c620bbc11a5d8ce7cbbf3df313d7fdccad8d93a2edffdf6"
		, currentSha256:
			"eed0dc2bd9d087c487196b32da297ca4e40eb1b9af779800384556272709b7fb"
		, count: 20
	})
	, Object.freeze({
		path: "src/backends/php/copied-values.mjs"
		, previousSha256:
			"eb62ac337326372d41b184c1628d3a1bc63d3f968bc429a5e6142d74f1b9bb7d"
		, currentSha256:
			"9c2b0120141797def8a295a630de4468f7623c9eae37f4d224dcad7a53d152ce"
		, count: 19
	})
	, Object.freeze({
		path: "src/backends/php/copied-zend.mjs"
		, previousSha256:
			"3a4919ac406a0365868a90f6c44ad16460a79666995e507e76d00d68861d4599"
		, currentSha256:
			"1296d8fc02dd00091eaaa2de467fb647b0ec59c8e6614dc3fd1fda089ecfd62e"
		, count: 16
	})
	, Object.freeze({
		path: "tests/native-php.test.mjs"
		, previousSha256:
			"bcedaccafb6fd72701933d251a529dcbf96c2b3d67aa1dd1aa20a3ffa92eed36"
		, currentSha256:
			"b8ae940ea7c75b363ed7d35ef4a6f662bb9febadea90f330ea1821c9091102db"
		, count: 3
	})
]);
export const inheritedCheckedRecordPhpPinRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/inherited-checked-record-php-source-history.test.mjs"
]);
export const inheritedCheckedRecordPhpPinRepairAddedPaths = Object.freeze([
	"scripts/update-inherited-checked-record-php-pin-repair-source-history.mjs"
	, "tests/helpers/inherited-checked-record-php-pin-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordPhpPinRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record PHP pin-repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordPhpPinRepairUpdate = (
	source, update
) => {
	assert.ok(inheritedCheckedRecordPhpPinRepairChangedPaths.includes(
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
export const beforeInheritedCheckedRecordPhpPinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordPhpPinRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordPhpPinRepairUpdate(source, update)
		: source;
};
