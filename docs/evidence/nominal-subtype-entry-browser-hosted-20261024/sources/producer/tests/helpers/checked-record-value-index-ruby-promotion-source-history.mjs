/**
 * Preserve the exact source transition that promotes hosted Ruby value-index
 * evidence into the public type surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexRubyPromotionHistoryPath
	= "docs/evidence/checked-record-value-index-ruby-promotion-source-history-20261020.json";
export const checkedRecordValueIndexRubyPromotionPredecessor
	= "2256f66b1fceef9613936b3b77c8eff429bfab88";
export const checkedRecordValueIndexRubyPromotionDraftParent
	= "f0b8737f876e94ee88bb2323bec7e11d13243f73";
export const checkedRecordValueIndexRubyPromotionFoundationModifiedPaths
	= Object.freeze([
		"docs/consume/ruby.md"
		, "docs/evidence/README.md"
		, "docs/type-surface.v1.json"
		, "tests/helpers/checked-record-value-index-ruby-evidence-tests.mjs"
		, "tests/type-surface.test.mjs"
	]);
export const checkedRecordValueIndexRubyPromotionFoundationAddedPaths
	= Object.freeze([
		"docs/evidence/checked-record-value-index-ruby-promotion-20261020.md"
		, "scripts/promote-checked-record-value-index-ruby.mjs"
		, "tests/helpers/checked-record-value-index-ruby-promotion-tests.mjs"
		, "tests/helpers/checked-record-value-index-ruby-promotion.mjs"
	]);
export const checkedRecordValueIndexRubyPromotionChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexRubyPromotionFoundationModifiedPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexRubyPromotionHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-ruby-promotion-source-history.mjs"
		, "tests/helpers/checked-record-value-index-ruby-promotion-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-ruby-promotion-source-history.mjs"
	]);
export const checkedRecordValueIndexRubyPromotionAddedSourcePaths
	= Object.freeze([
		...checkedRecordValueIndexRubyPromotionFoundationAddedPaths
		, ...checkedRecordValueIndexRubyPromotionHistoryAddedPaths
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexRubyPromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted Ruby value-index promotion transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexRubyPromotionUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexRubyPromotionChangedPaths.includes(
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
 * Remove only the exact hosted Ruby value-index promotion source layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexRubyPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexRubyPromotionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexRubyPromotionUpdate(source, update)
		: source;
};
