/**
 * Preserve the exact source transition that introduced the immutable hosted
 * WIT/WASI value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexWitArchiveHistoryPath
	= "docs/evidence/checked-record-value-index-wit-archive-source-history-20261020.json";
export const checkedRecordValueIndexWitArchivePredecessor
	= "dd2ee7a08530f5956912616442bc0a110c5708e9";
export const checkedRecordValueIndexWitArchiveDraftParent
	= "0af79d1441b0e8fb8b1e483a6c08811eaf0a2c21";
export const checkedRecordValueIndexWitArchiveRoot
	= "docs/evidence/checked-record-value-index-wit-20261020";
export const checkedRecordValueIndexWitArchiveIndexSha256
	= "a985723dd4dab68794a7061752c7dbf093c19a949a58b574a37063fa17d296b9";
export const checkedRecordValueIndexWitArchiveIndexedFileCount = 2036;
export const checkedRecordValueIndexWitArchiveFileCount = 2037;
export const checkedRecordValueIndexWitArchiveAddedFileCount = 2039;
export const checkedRecordValueIndexWitArchiveFoundationModifiedPaths
	= Object.freeze(["tests/checked-record-value-index-wit.test.mjs"]);
export const checkedRecordValueIndexWitArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-wit-evidence-tests.mjs"
		, "tests/helpers/checked-record-value-index-wit-evidence.mjs"
	]);
export const checkedRecordValueIndexWitArchiveChangedPaths
	= checkedRecordValueIndexWitArchiveFoundationModifiedPaths;
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexWitArchiveHistoryPath, "utf8"
));

/**
 * Reverse one exact WIT/WASI archive source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexWitArchiveUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexWitArchiveChangedPaths.includes(
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
 * Remove only the exact WIT/WASI archive layer from authenticated source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexWitArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexWitArchiveChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexWitArchiveUpdate(source, update)
		: source;
};
