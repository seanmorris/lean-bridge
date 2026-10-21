/**
 * Reverse the authenticated directional callback checked-record foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordFoundationHistoryPath
	= "docs/evidence/callback-checked-record-foundation-source-history-20261021.json";
export const callbackCheckedRecordFoundationPredecessor
	= "ac48e11d740d7f7d17476d3543e22f1cd94b759a";
export const callbackCheckedRecordFoundationImplementation
	= "f00a18f47b85698150b2fb423274033869cf55aa";
export const callbackCheckedRecordFoundationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/abi/refinements.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/semantic-model.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
/** The hub transition above spans the implementation and its history commit. */
export const callbackCheckedRecordFoundationIntegrationPaths = Object.freeze([]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordFoundationHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Current complete source text.
 * @param update - Recorded exact update.
 */
export const reverseCallbackCheckedRecordFoundationUpdate = (source, update) => {
	assert.ok(callbackCheckedRecordFoundationChangedPaths.includes(update.path));
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
 * Remove only this exact callback checked-record foundation milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordFoundationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordFoundationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackCheckedRecordFoundationUpdate(source, update) : source;
};
