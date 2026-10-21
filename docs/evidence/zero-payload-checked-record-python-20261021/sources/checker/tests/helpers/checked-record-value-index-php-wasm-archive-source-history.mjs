/**
 * Preserve the exact source transition that introduced the immutable hosted
 * PHP-Wasm value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPhpWasmArchiveHistoryPath
	= "docs/evidence/checked-record-value-index-php-wasm-archive-source-history-20261020.json";
export const checkedRecordValueIndexPhpWasmArchivePredecessor
	= "352c592c2bd85481d996759b812d597bc54b5354";
export const checkedRecordValueIndexPhpWasmArchiveDraftParent
	= "3bf9c4dc8437f48e86105e5d6f948197afe07e11";
export const checkedRecordValueIndexPhpWasmArchiveRoot
	= "docs/evidence/checked-record-value-index-php-wasm-20261020";
export const checkedRecordValueIndexPhpWasmArchiveIndexSha256
	= "049131f6a2ef0059dd3808252f980a12c5cf780d72677420f3107d285e26ba6f";
export const checkedRecordValueIndexPhpWasmArchiveIndexedFileCount = 2836;
export const checkedRecordValueIndexPhpWasmArchiveFileCount = 2837;
export const checkedRecordValueIndexPhpWasmArchiveAddedFileCount = 2839;
export const checkedRecordValueIndexPhpWasmArchiveFoundationModifiedPaths
	= Object.freeze(["tests/checked-record-value-index-php-wasm.test.mjs"]);
export const checkedRecordValueIndexPhpWasmArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-php-wasm-evidence-tests.mjs"
		, "tests/helpers/checked-record-value-index-php-wasm-evidence.mjs"
	]);
export const checkedRecordValueIndexPhpWasmArchiveChangedPaths
	= checkedRecordValueIndexPhpWasmArchiveFoundationModifiedPaths;
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPhpWasmArchiveHistoryPath, "utf8"
));

/**
 * Reverse one exact PHP-Wasm archive source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexPhpWasmArchiveUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexPhpWasmArchiveChangedPaths.includes(
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
 * Remove only the exact PHP-Wasm archive layer from authenticated source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPhpWasmArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPhpWasmArchiveChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexPhpWasmArchiveUpdate(source, update)
		: source;
};
