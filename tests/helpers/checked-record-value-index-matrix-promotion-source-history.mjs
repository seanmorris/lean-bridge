/**
 * Preserve the exact source transition that promotes the remaining hosted
 * value-index matrix into the public type surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexMatrixPromotionHistoryPath
	= "docs/evidence/checked-record-value-index-matrix-promotion-source-history-20261020.json";
export const checkedRecordValueIndexMatrixPromotionPredecessor
	= "fc1a0c8bae218192482acf0a82c88b6e5b86a974";
export const checkedRecordValueIndexMatrixPromotionDraftParent
	= "19a3e5455228526f5bb4e7089239d59f03f5e8f2";
export const checkedRecordValueIndexMatrixPromotionFoundationModifiedPaths
	= Object.freeze([
		"docs/consume/c.md"
		, "docs/consume/cpp.md"
		, "docs/consume/dotnet.md"
		, "docs/consume/java.md"
		, "docs/consume/kotlin.md"
		, "docs/evidence/README.md"
		, "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md"
		, "docs/reference/types.md"
		, "docs/type-surface.v1.json"
		, "scripts/generate-type-docs.mjs"
		, "tests/helpers/checked-record-value-index-native-ci-report.mjs"
		, "tests/helpers/checked-record-value-index-native-evidence.mjs"
		, "tests/type-surface.test.mjs"
	]);
export const checkedRecordValueIndexMatrixPromotionFoundationAddedPaths
	= Object.freeze([
		".github/workflows/checked-record-value-index-matrix.yml"
		, "docs/evidence/checked-record-value-index-matrix-promotion-20261020.md"
		, "scripts/promote-checked-record-value-index-matrix.mjs"
		, "tests/checked-record-value-index-matrix-inventory.test.mjs"
		, "tests/checked-record-value-index-matrix.test.mjs"
		, "tests/helpers/checked-record-value-index-matrix-promotion-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-promotion.mjs"
	]);
export const checkedRecordValueIndexMatrixPromotionChangedPaths
	= checkedRecordValueIndexMatrixPromotionFoundationModifiedPaths;
export const checkedRecordValueIndexMatrixPromotionHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-matrix-promotion-source-history.mjs"
		, "tests/helpers/checked-record-value-index-matrix-promotion-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-promotion-source-history.mjs"
	]);
export const checkedRecordValueIndexMatrixPromotionAddedSourcePaths
	= Object.freeze([
		...checkedRecordValueIndexMatrixPromotionFoundationAddedPaths
		, ...checkedRecordValueIndexMatrixPromotionHistoryAddedPaths
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexMatrixPromotionHistoryPath, "utf8"
));

/** Reverse one exact complete value-index matrix promotion transition. */
export const reverseCheckedRecordValueIndexMatrixPromotionUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexMatrixPromotionChangedPaths.includes(
		update.path));
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

/** Remove only the exact complete value-index matrix promotion layer. */
export const beforeCheckedRecordValueIndexMatrixPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexMatrixPromotionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexMatrixPromotionUpdate(source, update)
		: source;
};
