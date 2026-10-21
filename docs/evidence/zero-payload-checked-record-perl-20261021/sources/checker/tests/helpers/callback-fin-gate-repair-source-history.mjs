/**
 * Authenticate the fail-closed callback Fin gate added after the downstream
 * CI repair review.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinGateRepairHistoryPath
	= "docs/evidence/callback-fin-gate-repair-source-history-20261018.json";
export const callbackFinGateRepairPredecessor
	= "f01857bd7a9aca87f83065e150045f42a5d468e8";
export const callbackFinGateRepairDraftParent
	= "f01857bd7a9aca87f83065e150045f42a5d468e8";
export const callbackFinGateRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "schema/compiler-adapter-plan.schema.json"
	, "src/abi/refinements.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
	, "tests/helpers/checked-javascript-disposition-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackFinGateRepairAddedPaths = Object.freeze([
	"scripts/update-callback-fin-gate-repair-history.mjs"
	, "tests/helpers/callback-fin-gate-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	callbackFinGateRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact callback Fin gate repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCallbackFinGateRepairUpdate = (source, update) => {
	assert.ok(callbackFinGateRepairChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256);
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
	assert.equal(sha256(previous), update.previousSha256);
	return previous;
};

/**
 * Remove only this exact fail-closed callback gate repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackFinGateRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackFinGateRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackFinGateRepairUpdate(source, update)
		: source;
};
