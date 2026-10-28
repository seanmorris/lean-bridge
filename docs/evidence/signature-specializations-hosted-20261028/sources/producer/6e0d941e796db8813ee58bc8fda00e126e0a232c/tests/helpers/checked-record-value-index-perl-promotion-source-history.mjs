/**
 * Preserve the exact source transition that promotes hosted Perl value-index
 * evidence into the public type surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPerlPromotionHistoryPath
	= "docs/evidence/checked-record-value-index-perl-promotion-source-history-20261020.json";
export const checkedRecordValueIndexPerlPromotionPredecessor
	= "cb2c4d2dc9c6f9f0788a42719babfc8954eb8a6b";
export const checkedRecordValueIndexPerlPromotionDraftParent
	= "16481b91ea1f492fbe8a3782121453c27548d65c";
export const checkedRecordValueIndexPerlPromotionFoundationModifiedPaths
	= Object.freeze([
		"docs/consume/perl.md"
		, "docs/evidence/README.md"
		, "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md"
		, "docs/type-surface.v1.json"
		, "tests/helpers/checked-record-value-index-perl-evidence-tests.mjs"
	]);
export const checkedRecordValueIndexPerlPromotionFoundationAddedPaths
	= Object.freeze([
		"docs/evidence/checked-record-value-index-perl-promotion-20261020.md"
		, "scripts/promote-checked-record-value-index-perl.mjs"
		, "tests/helpers/checked-record-value-index-perl-promotion-tests.mjs"
		, "tests/helpers/checked-record-value-index-perl-promotion.mjs"
	]);
export const checkedRecordValueIndexPerlPromotionChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexPerlPromotionFoundationModifiedPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexPerlPromotionHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-perl-promotion-source-history.mjs"
		, "tests/helpers/checked-record-value-index-perl-promotion-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-perl-promotion-source-history.mjs"
	]);
export const checkedRecordValueIndexPerlPromotionAddedSourcePaths
	= Object.freeze([
		...checkedRecordValueIndexPerlPromotionFoundationAddedPaths
		, ...checkedRecordValueIndexPerlPromotionHistoryAddedPaths
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPerlPromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted Perl value-index promotion transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexPerlPromotionUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexPerlPromotionChangedPaths.includes(
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
 * Remove only the exact hosted Perl value-index promotion source layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPerlPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPerlPromotionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexPerlPromotionUpdate(source, update)
		: source;
};
