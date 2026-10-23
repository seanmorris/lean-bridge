/**
 * Reverse the callback-history evidence-pin reconciliation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeHistoryPinReconciliationHistoryPath
	= "docs/evidence/callback-subtype-history-pin-reconciliation-source-history-20261021.json";
export const callbackSubtypeHistoryPinReconciliationPredecessor
	= "c04388551bfc4ada383540b90eba4a169fff9e8a";
export const callbackSubtypeHistoryPinReconciliationImplementation
	= "2b33749ca85b3ce37a8fcb68fa9beb4db47b2098";
export const callbackSubtypeHistoryPinReconciliationChangedPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const callbackSubtypeHistoryPinReconciliationIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/zero-payload-checked-record-hosted-promotion.test.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeHistoryPinReconciliationHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact pin transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeHistoryPinReconciliationUpdate = (
	source, update
) => {
	assert.ok([...callbackSubtypeHistoryPinReconciliationChangedPaths
		, ...callbackSubtypeHistoryPinReconciliationIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this pin reconciliation from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeHistoryPinReconciliationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...callbackSubtypeHistoryPinReconciliationChangedPaths
			, ...callbackSubtypeHistoryPinReconciliationIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeHistoryPinReconciliationUpdate(source, update)
		: source;
};
