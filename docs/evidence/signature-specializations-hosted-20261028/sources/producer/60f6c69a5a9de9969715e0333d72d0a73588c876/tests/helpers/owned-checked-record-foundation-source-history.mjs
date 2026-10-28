/**
 * Reverse the authenticated owned checked-record source foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordFoundationHistoryPath
	= "docs/evidence/owned-checked-record-foundation-source-history-20261022.json";
export const ownedCheckedRecordFoundationPredecessor
	= "62f29794ea5f7fbaeeea21ac8e4f9876efdf5330";
export const ownedCheckedRecordFoundationImplementation
	= "d66c823e1258610ba1ca8bd2f7d5e1c7deb6f051";
export const ownedCheckedRecordFoundationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/abi/refinements.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/owned-metadata-graph.mjs"
	, "src/analyze/reviewed-owned-source.mjs"
	, "tests/helpers/dependent-record-constructor-authority-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
/** The hub transition above spans the implementation and its history commit. */
export const ownedCheckedRecordFoundationIntegrationPaths = Object.freeze([]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordFoundationHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Current complete source text.
 * @param update - Recorded exact update.
 */
export const reverseOwnedCheckedRecordFoundationUpdate = (source, update) => {
	assert.ok(ownedCheckedRecordFoundationChangedPaths.includes(update.path));
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
 * Remove only this exact owned checked-record foundation milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordFoundationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordFoundationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseOwnedCheckedRecordFoundationUpdate(source, update) : source;
};
