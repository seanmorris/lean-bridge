/**
 * Preserve the exact source transition that introduced the immutable hosted
 * native-PHP value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPhpArchiveHistoryPath
	= "docs/evidence/checked-record-value-index-php-archive-source-history-20261019.json";
export const checkedRecordValueIndexPhpArchivePredecessor
	= "f3776db652eff126411c9a52173beb34a0c5bc90";
export const checkedRecordValueIndexPhpArchiveDraftParent
	= "973a39643b885b4e251da40af7ba2697ccd91c9e";
export const checkedRecordValueIndexPhpArchiveRoot
	= "docs/evidence/checked-record-value-index-php-20261019";
export const checkedRecordValueIndexPhpArchiveIndexSha256
	= "cc707f049a1beb59a8e2fb0d9324baa45e39515f50e5c6ac1d11772673d1642e";
export const checkedRecordValueIndexPhpArchiveIndexedFileCount = 1437;
export const checkedRecordValueIndexPhpArchiveAddedFileCount = 1440;
export const checkedRecordValueIndexPhpArchiveFoundationModifiedPaths
	= Object.freeze(["tests/checked-record-value-index-php.test.mjs"]);
export const checkedRecordValueIndexPhpArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-php-evidence-tests.mjs"
		, "tests/helpers/checked-record-value-index-php-evidence.mjs"
	]);
export const checkedRecordValueIndexPhpArchiveChangedPaths
	= checkedRecordValueIndexPhpArchiveFoundationModifiedPaths;
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPhpArchiveHistoryPath, "utf8"
));

/**
 * Reverse one exact native-PHP archive source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexPhpArchiveUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexPhpArchiveChangedPaths.includes(
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
 * Remove only the exact archive layer from an authenticated source file.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPhpArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPhpArchiveChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexPhpArchiveUpdate(source, update)
		: source;
};
