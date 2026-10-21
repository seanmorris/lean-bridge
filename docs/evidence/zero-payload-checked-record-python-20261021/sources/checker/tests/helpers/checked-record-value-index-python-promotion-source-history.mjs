/**
 * Preserve the exact source transition that promotes hosted Python
 * value-index evidence into the public type surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPythonPromotionHistoryPath
	= "docs/evidence/checked-record-value-index-python-promotion-source-history-20261020.json";
export const checkedRecordValueIndexPythonPromotionPredecessor
	= "728295ad6b29f8dd34f9d1cfb80cd37635db5f7c";
export const checkedRecordValueIndexPythonPromotionDraftParent
	= "9235cb1ebe98ac47f5fab9b44f57d2373efb89fd";
export const checkedRecordValueIndexPythonPromotionFoundationModifiedPaths
	= Object.freeze([
		"docs/consume/perl.md"
		, "docs/consume/python.md"
		, "docs/evidence/README.md"
		, "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md"
		, "docs/type-surface.v1.json"
		, "tests/helpers/checked-record-value-index-python-evidence-tests.mjs"
		, "tests/type-surface.test.mjs"
	]);
export const checkedRecordValueIndexPythonPromotionFoundationAddedPaths
	= Object.freeze([
		"docs/evidence/checked-record-value-index-python-promotion-20261020.md"
		, "scripts/promote-checked-record-value-index-python.mjs"
		, "tests/helpers/checked-record-value-index-python-promotion-tests.mjs"
		, "tests/helpers/checked-record-value-index-python-promotion.mjs"
	]);
export const checkedRecordValueIndexPythonPromotionChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexPythonPromotionFoundationModifiedPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexPythonPromotionHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-python-promotion-source-history.mjs"
		, "tests/helpers/checked-record-value-index-python-promotion-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-python-promotion-source-history.mjs"
	]);
export const checkedRecordValueIndexPythonPromotionAddedSourcePaths
	= Object.freeze([
		...checkedRecordValueIndexPythonPromotionFoundationAddedPaths
		, ...checkedRecordValueIndexPythonPromotionHistoryAddedPaths
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPythonPromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted Python value-index promotion transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexPythonPromotionUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexPythonPromotionChangedPaths.includes(
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
 * Remove only the exact hosted Python value-index promotion source layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPythonPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPythonPromotionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexPythonPromotionUpdate(source, update)
		: source;
};
