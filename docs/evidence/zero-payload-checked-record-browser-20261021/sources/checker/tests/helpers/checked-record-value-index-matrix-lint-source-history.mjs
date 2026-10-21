/**
 * Preserve the exact value-index matrix lint repair and its history wiring.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexMatrixLintHistoryPath
	= "docs/evidence/checked-record-value-index-matrix-lint-source-history-20261020.json";
export const checkedRecordValueIndexMatrixLintPredecessor
	= "ef8a07504d8c78326d58deac2fbf19f7f9290356";
export const checkedRecordValueIndexMatrixLintDraftParent
	= "80e297f231b63d8cf1550251d17e7cbfa76dfc0d";
export const checkedRecordValueIndexMatrixLintFoundationModifiedPaths
	= Object.freeze([
		"scripts/promote-checked-record-value-index-matrix.mjs"
		, "scripts/update-checked-record-value-index-matrix-checkout-source-history.mjs"
		, "scripts/update-checked-record-value-index-matrix-history-gap-source-history.mjs"
		, "scripts/update-checked-record-value-index-matrix-promotion-source-history.mjs"
		, "scripts/update-checked-record-value-index-matrix-registration-source-history.mjs"
		, "tests/checked-record-value-index-matrix-inventory.test.mjs"
		, "tests/checked-record-value-index-matrix.test.mjs"
		, "tests/helpers/checked-record-value-index-matrix-checkout-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-checkout-source-history.mjs"
		, "tests/helpers/checked-record-value-index-matrix-history-gap-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-history-gap-source-history.mjs"
		, "tests/helpers/checked-record-value-index-matrix-promotion-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-promotion-source-history.mjs"
		, "tests/helpers/checked-record-value-index-matrix-promotion-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-promotion.mjs"
		, "tests/helpers/checked-record-value-index-matrix-registration-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-registration-source-history.mjs"
		, "tests/helpers/checked-record-value-index-php-wasm-report.mjs"
		, "tests/helpers/checked-record-value-index-rust-fixture-tests.mjs"
	]);
export const checkedRecordValueIndexMatrixLintChangedPaths = Object.freeze([
	...checkedRecordValueIndexMatrixLintFoundationModifiedPaths
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexMatrixLintAddedPaths = Object.freeze([
	"scripts/update-checked-record-value-index-matrix-lint-source-history.mjs"
	, "tests/helpers/checked-record-value-index-matrix-lint-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-matrix-lint-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexMatrixLintHistoryPath, "utf8"
));

/**
 * Reverse one exact matrix lint transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexMatrixLintUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexMatrixLintChangedPaths.includes(update.path));
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
 * Remove only the exact value-index matrix lint layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexMatrixLintSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexMatrixLintChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexMatrixLintUpdate(source, update)
		: source;
};
