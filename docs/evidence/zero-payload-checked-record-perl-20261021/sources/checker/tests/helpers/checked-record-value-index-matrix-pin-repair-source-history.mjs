/**
 * Preserve the exact value-index matrix type-surface pin repair and wiring.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexMatrixPinRepairHistoryPath
	= "docs/evidence/checked-record-value-index-matrix-pin-repair-source-history-20261020.json";
export const checkedRecordValueIndexMatrixPinRepairPredecessor
	= "e4bdd7311e41be2d42a4520ebe0cdad98660722c";
export const checkedRecordValueIndexMatrixPinRepairDraftParent
	= "335f5a80e2affbac154293df9092960e4f2ad530";
export const checkedRecordValueIndexMatrixPinRepairPreviousProfileSha256
	= "7258c77a190aa742b65a5bfc5b157976b2d152f84714f1b404666ad5efdc3887";
export const checkedRecordValueIndexMatrixPinRepairCurrentProfileSha256
	= "51cf77fb11f603407943bf2c56a763e0d3cc627a47c48868ef6604525f8040f1";
export const checkedRecordValueIndexMatrixPinRepairPins = Object.freeze([
	Object.freeze({
		path: "src/adoption/test-profiles.mjs"
		, previousSha256:
			checkedRecordValueIndexMatrixPinRepairPreviousProfileSha256
		, currentSha256:
			checkedRecordValueIndexMatrixPinRepairCurrentProfileSha256
		, count: 94
	})
]);
export const checkedRecordValueIndexMatrixPinRepairFoundationModifiedPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const checkedRecordValueIndexMatrixPinRepairChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexMatrixPinRepairFoundationModifiedPaths
		, "tests/checked-record-value-index-matrix.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexMatrixPinRepairAddedPaths = Object.freeze([
	"scripts/update-checked-record-value-index-matrix-pin-repair-source-history.mjs"
	, "tests/helpers/checked-record-value-index-matrix-pin-repair-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-matrix-pin-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexMatrixPinRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact matrix pin-repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexMatrixPinRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexMatrixPinRepairChangedPaths.includes(
		update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.replacements !== undefined)
	{
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		for(const replacement of [...update.replacements].reverse())
		{
			assert.deepEqual(Object.keys(replacement).sort()
				, ["count", "current", "previous"]);
			assert.equal(typeof replacement.previous, "string");
			assert.equal(typeof replacement.current, "string");
			assert.notEqual(replacement.previous, replacement.current);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.current).length - 1
				, replacement.count, update.path);
			source = source.replaceAll(
				replacement.current, replacement.previous
			);
		}
		assert.equal(sha256(source), update.previousSha256, update.path);
		return source;
	}
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
 * Remove only the exact value-index matrix pin-repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexMatrixPinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexMatrixPinRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexMatrixPinRepairUpdate(source, update)
		: source;
};
