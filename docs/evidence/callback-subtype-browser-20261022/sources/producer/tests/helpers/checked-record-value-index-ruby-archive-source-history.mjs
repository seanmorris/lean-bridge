/**
 * Preserve the exact source transition that introduced the immutable hosted
 * Ruby value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexRubyArchiveHistoryPath
	= "docs/evidence/checked-record-value-index-ruby-archive-source-history-20261020.json";
export const checkedRecordValueIndexRubyArchivePredecessor
	= "97ada316244c877560c42b5821216a0d19f0dab4";
export const checkedRecordValueIndexRubyArchiveDraftParent
	= "0e432a58da0a121fc17ca06b17cb9293da10e8ad";
export const checkedRecordValueIndexRubyArchiveRoot
	= "docs/evidence/checked-record-value-index-ruby-20261020";
export const checkedRecordValueIndexRubyArchiveIndexSha256
	= "f1caf88b4d1eb543d0b954a7776b773772ed763933fa123942bf459d0d7cbd12";
export const checkedRecordValueIndexRubyArchiveIndexedFileCount = 1792;
export const checkedRecordValueIndexRubyArchiveFileCount = 1793;
export const checkedRecordValueIndexRubyArchiveAddedFileCount = 1795;
export const checkedRecordValueIndexRubyArchiveFoundationModifiedPaths
	= Object.freeze(["tests/checked-record-value-index-ruby.test.mjs"]);
export const checkedRecordValueIndexRubyArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-ruby-evidence-tests.mjs"
		, "tests/helpers/checked-record-value-index-ruby-evidence.mjs"
	]);
export const checkedRecordValueIndexRubyArchiveChangedPaths
	= checkedRecordValueIndexRubyArchiveFoundationModifiedPaths;
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexRubyArchiveHistoryPath, "utf8"
));

/**
 * Reverse one exact Ruby archive source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexRubyArchiveUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexRubyArchiveChangedPaths.includes(update.path));
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
 * Remove only the exact Ruby archive layer from authenticated source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexRubyArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexRubyArchiveChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexRubyArchiveUpdate(source, update)
		: source;
};
