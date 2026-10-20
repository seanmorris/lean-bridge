/**
 * Authenticate the exact full-matrix documentation and CI closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNestedCheckedRecordRustPromotionPins
	, beforeNestedCheckedRecordRustPromotionSource
} from "./nested-checked-record-rust-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordMatrixClosureHistoryPath
	= "docs/evidence/nested-checked-record-matrix-closure-source-history-20261016.json";
export const nestedCheckedRecordMatrixClosurePredecessor
	= "136b45b58ec0a1e0c43f0c41d971f2f547a0dc8f";
export const nestedCheckedRecordMatrixClosureDraftParent
	= nestedCheckedRecordMatrixClosurePredecessor;
export const nestedCheckedRecordMatrixClosureChangedPaths = [
	"docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/wit-wasi.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/type-surface-docs.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseNestedCheckedRecordMatrixClosureUpdate = (source, update) => {
	assert.ok(nestedCheckedRecordMatrixClosureChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
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
 * Remove only this matrix closure when its complete current identity matches.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNestedCheckedRecordMatrixClosure = (path, source) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordMatrixClosureChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordMatrixClosureHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNestedCheckedRecordMatrixClosureUpdate(source, update) : source;
};

/**
 * Reverse this matrix closure, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNestedCheckedRecordMatrixClosureSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordMatrixClosureChangedPaths.includes(path))
		return beforeNestedCheckedRecordRustPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutNestedCheckedRecordMatrixClosure(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordRustPromotionSource(path, source, expected);
};

/**
 * Restore source pins through this matrix closure and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNestedCheckedRecordMatrixClosurePins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordMatrixClosureHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeNestedCheckedRecordRustPromotionPins(previous);
};
