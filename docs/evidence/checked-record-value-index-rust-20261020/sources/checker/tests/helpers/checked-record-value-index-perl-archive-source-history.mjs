/**
 * Preserve the exact source transition that introduced the immutable hosted
 * Perl value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPerlArchiveHistoryPath
	= "docs/evidence/checked-record-value-index-perl-archive-source-history-20261020.json";
export const checkedRecordValueIndexPerlArchivePredecessor
	= "99ebea35d6eaf3f7a5a0d53a5e855f2348b8c25b";
export const checkedRecordValueIndexPerlArchiveDraftParent
	= "3d543b1eb175de2859a2b6485c3d6fa528e83d6a";
export const checkedRecordValueIndexPerlArchiveRoot
	= "docs/evidence/checked-record-value-index-perl-20261019";
export const checkedRecordValueIndexPerlArchiveIndexSha256
	= "ffb4b76ea9e79a3035f6b84c586101c034e0f29dad67ddd79b225e7e9f75b2a9";
export const checkedRecordValueIndexPerlArchiveIndexedFileCount = 2175;
export const checkedRecordValueIndexPerlArchiveFileCount = 2176;
export const checkedRecordValueIndexPerlArchiveAddedFileCount = 2178;
export const checkedRecordValueIndexPerlArchiveFoundationModifiedPaths
	= Object.freeze(["tests/checked-record-value-index-perl.test.mjs"]);
export const checkedRecordValueIndexPerlArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-perl-evidence-tests.mjs"
		, "tests/helpers/checked-record-value-index-perl-evidence.mjs"
	]);
export const checkedRecordValueIndexPerlArchiveChangedPaths
	= checkedRecordValueIndexPerlArchiveFoundationModifiedPaths;
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPerlArchiveHistoryPath, "utf8"
));

/**
 * Reverse one exact Perl archive source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexPerlArchiveUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexPerlArchiveChangedPaths.includes(update.path));
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
 * Remove only the exact Perl archive layer from an authenticated source file.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPerlArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPerlArchiveChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexPerlArchiveUpdate(source, update)
		: source;
};
