/**
 * Preserve the exact transition that introduced hosted Rust value-index evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexRustArchiveHistoryPath
	= "docs/evidence/checked-record-value-index-rust-archive-source-history-20261020.json";
export const checkedRecordValueIndexRustArchivePredecessor
	= "019b6896f876878c9547305d7f755a54c62a03ff";
export const checkedRecordValueIndexRustArchiveDraftParent
	= "456713bcfc24997101a99fefb6e60bd1f9e57ab0";
export const checkedRecordValueIndexRustArchiveRoot
	= "docs/evidence/checked-record-value-index-rust-20261020";
export const checkedRecordValueIndexRustArchiveIndexSha256
	= "38312f1cc0d63b51343477f5a0f1681b39eff75308e9c80f710e6524183232ea";
export const checkedRecordValueIndexRustArchiveIndexedFileCount = 1936;
export const checkedRecordValueIndexRustArchiveFileCount = 1937;
export const checkedRecordValueIndexRustArchiveAddedFileCount = 1939;
export const checkedRecordValueIndexRustArchiveFoundationModifiedPaths
	= Object.freeze(["tests/checked-record-value-index-rust.test.mjs"]);
export const checkedRecordValueIndexRustArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-rust-evidence-tests.mjs"
		, "tests/helpers/checked-record-value-index-rust-evidence.mjs"
	]);
export const checkedRecordValueIndexRustArchiveChangedPaths
	= checkedRecordValueIndexRustArchiveFoundationModifiedPaths;
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexRustArchiveHistoryPath, "utf8"));

/**
 * Reverse one authenticated Rust archive source update.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexRustArchiveUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexRustArchiveChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
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
 * Remove only the authenticated Rust archive layer from one source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexRustArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexRustArchiveChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexRustArchiveUpdate(source, update) : source;
};
