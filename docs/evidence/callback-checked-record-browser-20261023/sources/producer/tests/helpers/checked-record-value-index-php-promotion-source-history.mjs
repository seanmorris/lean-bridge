/**
 * Preserve the exact source transition that promotes hosted native-PHP
 * value-index evidence into the public type surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPhpPromotionHistoryPath
	= "docs/evidence/checked-record-value-index-php-promotion-source-history-20261019.json";
export const checkedRecordValueIndexPhpPromotionPredecessor
	= "93896ab11021e1c021e801f6c8ba7ac4ffbdf182";
export const checkedRecordValueIndexPhpPromotionDraftParent
	= "4068db0f0b2833bf2ca7e2d7a82d50beef9112bf";
export const checkedRecordValueIndexPhpPromotionFoundationModifiedPaths
	= Object.freeze([
		"docs/evidence/README.md"
		, "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md"
		, "docs/php.md"
		, "docs/type-surface.v1.json"
		, "tests/helpers/checked-record-value-index-php-evidence-tests.mjs"
	]);
export const checkedRecordValueIndexPhpPromotionFoundationAddedPaths
	= Object.freeze([
		"docs/evidence/checked-record-value-index-php-promotion-20261019.md"
		, "scripts/promote-checked-record-value-index-php.mjs"
		, "tests/helpers/checked-record-value-index-php-promotion-tests.mjs"
		, "tests/helpers/checked-record-value-index-php-promotion.mjs"
	]);
export const checkedRecordValueIndexPhpPromotionChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexPhpPromotionFoundationModifiedPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexPhpPromotionHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-php-promotion-source-history.mjs"
		, "tests/helpers/checked-record-value-index-php-promotion-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-php-promotion-source-history.mjs"
	]);
export const checkedRecordValueIndexPhpPromotionAddedSourcePaths
	= Object.freeze([
		...checkedRecordValueIndexPhpPromotionFoundationAddedPaths
		, ...checkedRecordValueIndexPhpPromotionHistoryAddedPaths
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPhpPromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted native-PHP value-index promotion source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexPhpPromotionUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexPhpPromotionChangedPaths.includes(
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
 * Remove only the exact hosted native-PHP value-index promotion source layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPhpPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPhpPromotionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexPhpPromotionUpdate(source, update)
		: source;
};
