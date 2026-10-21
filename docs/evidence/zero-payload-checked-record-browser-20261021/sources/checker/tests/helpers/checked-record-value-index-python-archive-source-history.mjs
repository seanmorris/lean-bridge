/**
 * Preserve the exact source transition that introduced the immutable hosted
 * Python value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPythonArchiveHistoryPath
	= "docs/evidence/checked-record-value-index-python-archive-source-history-20261020.json";
export const checkedRecordValueIndexPythonArchivePredecessor
	= "8bc597686328278d4ea78551e08d7862c996eb0c";
export const checkedRecordValueIndexPythonArchiveDraftParent
	= "6f90d9e54c38d5e06cad98dfb1d2afbb58b0cdb1";
export const checkedRecordValueIndexPythonArchiveRoot
	= "docs/evidence/checked-record-value-index-python-20261020";
export const checkedRecordValueIndexPythonArchiveIndexSha256
	= "f06a15fd17e5a78c62c7d3a2e4fd0bc07d5acc1e96dfbf95f42d3203d88aa8c7";
export const checkedRecordValueIndexPythonArchiveIndexedFileCount = 1415;
export const checkedRecordValueIndexPythonArchiveFileCount = 1416;
export const checkedRecordValueIndexPythonArchiveAddedFileCount = 1418;
export const checkedRecordValueIndexPythonArchiveFoundationModifiedPaths
	= Object.freeze(["tests/checked-record-value-index-python.test.mjs"]);
export const checkedRecordValueIndexPythonArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-python-evidence-tests.mjs"
		, "tests/helpers/checked-record-value-index-python-evidence.mjs"
	]);
export const checkedRecordValueIndexPythonArchiveChangedPaths
	= checkedRecordValueIndexPythonArchiveFoundationModifiedPaths;
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPythonArchiveHistoryPath, "utf8"
));

/**
 * Reverse one exact Python archive source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexPythonArchiveUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexPythonArchiveChangedPaths.includes(update.path));
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
 * Remove only the exact Python archive layer from authenticated source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPythonArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPythonArchiveChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexPythonArchiveUpdate(source, update)
		: source;
};
