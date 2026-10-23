/**
 * Reverse the authenticated owned checked-record callback/closure foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordCallableHistoryPath
	= "docs/evidence/owned-checked-record-callable-source-history-20261022.json";
export const ownedCheckedRecordCallablePredecessor
	= "d5b2b31e640de6be9dc00188de8c793b126b2136";
export const ownedCheckedRecordCallableImplementation
	= "a9945b450e06c61dfe1f3f1523bd36b11975bf03";
export const ownedCheckedRecordCallableHistoricalPaths = Object.freeze([
	"src/abi/owned-aggregate-model.mjs"
	, "src/abi/owned-refinement-model.mjs"
	, "src/abi/refinements.mjs"
	, "src/analyze/reviewed-owned-source.mjs"
	, "src/backends/c/owned-callbacks.mjs"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/build/owned-aggregate-carriers.mjs"
	, "src/build/owned-callback-carriers.mjs"
	, "src/build/owned-refinement-carriers.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
]);
export const ownedCheckedRecordCallableRegistrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/dependent-record-constructor-authority-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const ownedCheckedRecordCallableChangedPaths = Object.freeze([
	...ownedCheckedRecordCallableRegistrationPaths
	, ...ownedCheckedRecordCallableHistoricalPaths
]);
export const ownedCheckedRecordCallableAddedPaths = Object.freeze([
	"scripts/update-owned-checked-record-callable-source-history.mjs"
	, "tests/helpers/owned-checked-record-callable-source-history.mjs"
	, "tests/helpers/owned-checked-record-callable-source-history-tests.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordCallableHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Complete current source text.
 * @param update - Recorded exact update.
 */
export const reverseOwnedCheckedRecordCallableUpdate = (source, update) => {
	assert.ok(ownedCheckedRecordCallableChangedPaths.includes(update.path));
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
 * Remove only the exact owned checked-record callable layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordCallableSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordCallableChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseOwnedCheckedRecordCallableUpdate(source, update)
		: source;
};
