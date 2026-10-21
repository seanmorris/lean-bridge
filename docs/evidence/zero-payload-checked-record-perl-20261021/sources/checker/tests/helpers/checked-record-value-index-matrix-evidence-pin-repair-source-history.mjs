/**
 * Preserve the final value-index matrix evidence-pin repair and wiring.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexMatrixEvidencePinRepairHistoryPath
	= "docs/evidence/checked-record-value-index-matrix-evidence-pin-repair-source-history-20261020.json";
export const checkedRecordValueIndexMatrixEvidencePinRepairPredecessor
	= "6351a5d83de652441314e4a986e33de312a39953";
export const checkedRecordValueIndexMatrixEvidencePinRepairDraftParent
	= checkedRecordValueIndexMatrixEvidencePinRepairPredecessor;
export const checkedRecordValueIndexMatrixEvidencePinRepairPins
	= Object.freeze([
		Object.freeze({
			path: ".github/workflows/checked-record-value-index-matrix.yml"
			, previousSha256:
				"d2662bd6f62fb9701c07f19cf2b7feb49d6fbd30a882ef9a0edb68f1eaa427a0"
			, currentSha256:
				"8cd74c79bd4ab8efb4aa988b6f7129335b8d5cf4b209c0f5b838d29f741a3646"
			, count: 12
		})
		, Object.freeze({
			path: "scripts/promote-checked-record-value-index-matrix.mjs"
			, previousSha256:
				"6bc8619f25be0eaae79a71b2c759971d6dc3fd1a63d342034399057191c2c8cf"
			, currentSha256:
				"aefd698e3df15ce80e573c5e290a10786947d0727c7c3f5dc96b284337fe35c0"
			, count: 12
		})
		, Object.freeze({
			path: "tests/checked-record-value-index-matrix.test.mjs"
			, previousSha256:
				"2d1b3e158bb0d0abf8d32aa594919f9c373ff3d904d612b66c40fced53f598d4"
			, currentSha256:
				"d85dc20ccd2e87b186c140aa9bb9d17f12bd7d898678789d2f97dfacf6af991e"
			, count: 12
		})
		, Object.freeze({
			path: "tests/checked-record-value-index-matrix-inventory.test.mjs"
			, previousSha256:
				"f54ddd5beea38b1592064e2466964c5d915ccd24f6e74c4e1f9609ea643cb76f"
			, currentSha256:
				"5cd9903071732d90b04f3046f6a790fc170fc3cd5d766bda17e4f59543aa0182"
			, count: 12
		})
		, Object.freeze({
			path: "tests/helpers/checked-record-value-index-matrix-promotion.mjs"
			, previousSha256:
				"b20857a7840bd922824cbd7df9bf3adf7a93f7eeb23d786f03cbe5fbbe90aa0d"
			, currentSha256:
				"6f3357d98ca19f9dc69855481f59b6f152fe76ff58e8513c42fb298562cb0dc9"
			, count: 12
		})
		, Object.freeze({
			path: "tests/helpers/checked-record-value-index-matrix-promotion-tests.mjs"
			, previousSha256:
				"78fa499bf77755f70b5ae26b2c6b7085994cb029e93efb879b6233cd60e5ff7b"
			, currentSha256:
				"a26f193c206b67b8bdd53ab9960eb043b9ec316a04224e368924e9b4c4aab67e"
			, count: 12
		})
	]);
export const checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/checked-record-value-index-matrix-pin-repair-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexMatrixEvidencePinRepairAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-matrix-evidence-pin-repair-source-history.mjs"
		, "tests/helpers/checked-record-value-index-matrix-evidence-pin-repair-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-evidence-pin-repair-source-history.mjs"
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexMatrixEvidencePinRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact matrix evidence-pin repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexMatrixEvidencePinRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths.includes(
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
 * Remove only the final value-index matrix evidence-pin repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexMatrixEvidencePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths.includes(
			path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexMatrixEvidencePinRepairUpdate(
			source, update
		) : source;
};
