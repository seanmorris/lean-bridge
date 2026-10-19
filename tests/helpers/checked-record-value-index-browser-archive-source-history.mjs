/**
 * Authenticate the hosted value-index browser archive as one exact reversible
 * source transition without treating the archive as support promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexBrowserArchiveHistoryPath
	= "docs/evidence/checked-record-value-index-browser-archive-source-history-20261019.json";
export const checkedRecordValueIndexBrowserArchivePredecessor
	= "42f841b82394cb71043bcfaf063be57542b5d0c9";
export const checkedRecordValueIndexBrowserArchiveDraftParent
	= "29c05805e774cf4d6850083a85788398a128d581";
export const checkedRecordValueIndexBrowserArchiveRoot
	= "docs/evidence/checked-record-value-index-browser-20261019";
export const checkedRecordValueIndexBrowserArchiveIndexSha256
	= "c776acf181b38744191bddbfbe515f14e515d59eaa94e4a942acddc8c76b34e0";
export const checkedRecordValueIndexBrowserArchiveIndexedFileCount = 2227;
export const checkedRecordValueIndexBrowserArchiveAddedFileCount = 2228;
export const checkedRecordValueIndexBrowserArchiveFoundationModifiedPaths
	= Object.freeze([
		"tests/checked-record-value-index-browser.test.mjs"
	]);
export const checkedRecordValueIndexBrowserArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-browser-evidence-tests.mjs"
		, "tests/helpers/checked-record-value-index-browser-evidence.mjs"
	]);
export const checkedRecordValueIndexBrowserArchiveChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexBrowserArchiveFoundationModifiedPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexBrowserArchiveHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-browser-archive-source-history.mjs"
		, "tests/helpers/checked-record-value-index-browser-archive-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-browser-archive-source-history.mjs"
	]);
export const checkedRecordValueIndexBrowserArchiveAddedSourcePaths
	= Object.freeze([
		...checkedRecordValueIndexBrowserArchiveFoundationAddedPaths
		, ...checkedRecordValueIndexBrowserArchiveHistoryAddedPaths
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexBrowserArchiveHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted browser-archive transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexBrowserArchiveUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexBrowserArchiveChangedPaths.includes(
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
 * Remove only the exact hosted value-index browser archive source layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexBrowserArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexBrowserArchiveChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexBrowserArchiveUpdate(source, update)
		: source;
};
