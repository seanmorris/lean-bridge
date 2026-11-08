/**
 * Authenticate the exact live-pin repair for the bounded promotion contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220NestedPromotionMemoryBoundPinRepairHistoryPath
	= "docs/evidence/vo1220-nested-promotion-memory-bound-pin-repair-source-history-20261108.json";
export const vo1220NestedPromotionMemoryBoundPinRepairPredecessor
	= "e15467299fabddbf39d4b26c4e461e831edb02ca";
export const vo1220NestedPromotionMemoryBoundPinRepairImplementation
	= "855d239b16213ac9d1cc06d7080c096fc235496a";
export const vo1220NestedPromotionMemoryBoundPinRepairSourcePaths
	= Object.freeze([
		"tests/helpers/nested-checked-record-native-promotion-tests.mjs"
		, "tests/helpers/nested-checked-record-python-promotion-tests.mjs"
		, "tests/helpers/recursive-checked-record-promotion-tests.mjs"
	]);
export const vo1220NestedPromotionMemoryBoundPinRepairImplementationPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const vo1220NestedPromotionMemoryBoundPinRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220NestedPromotionMemoryBoundPinRepairNormalizationPaths
	= Object.freeze([
		...vo1220NestedPromotionMemoryBoundPinRepairImplementationPaths
		, ...vo1220NestedPromotionMemoryBoundPinRepairIntegrationPaths
	]);
export const vo1220NestedPromotionMemoryBoundPinRepairAdditions
	= Object.freeze([
		"scripts/update-vo1220-nested-promotion-memory-bound-pin-repair-source-history.mjs"
		, "tests/helpers/vo1220-nested-promotion-memory-bound-pin-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-nested-promotion-memory-bound-pin-repair-source-history.mjs"
	]);
export const vo1220NestedPromotionMemoryBoundPinRepairBehavior = Object.freeze({
	refreshedPins: 44, refreshedPaths: 3
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220NestedPromotionMemoryBoundPinRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact pin-repair transition.
 *
 * @param source - Complete later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220NestedPromotionMemoryBoundPinRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220NestedPromotionMemoryBoundPinRepairNormalizationPaths
		.includes(update.path));
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
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this exact live-pin repair and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220NestedPromotionMemoryBoundPinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220NestedPromotionMemoryBoundPinRepairNormalizationPaths
			.includes(path))
		return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates
		, record().implementationUpdates
	]) {
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220NestedPromotionMemoryBoundPinRepairUpdate(
				current, update);
	}
	return current;
};
