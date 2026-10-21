/**
 * Close the three omitted checked-record value-index profile registrations
 * without rewriting their historical commits or their earlier ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexTestProfileGapHistoryPath
	= "docs/evidence/value-index-test-profile-gap-source-history-20261019.json";
export const valueIndexTestProfileGapPredecessor
	= "2ad8485f3ada7e419cad47c5f426a8a30537b2da";
export const valueIndexTestProfileGapDraftParent
	= "2ad8485f3ada7e419cad47c5f426a8a30537b2da";
export const valueIndexTestProfileGapChangedPaths = Object.freeze([
	"docs/php.md"
	, "docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const valueIndexTestProfileGapHistoricalPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const valueIndexTestProfileGapAddedPaths = Object.freeze([
	"scripts/update-value-index-test-profile-gap-source-history.mjs"
	, "tests/helpers/value-index-test-profile-gap-source-history.mjs"
	, "tests/helpers/value-index-test-profile-gap-source-history-tests.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	valueIndexTestProfileGapHistoryPath, "utf8"
));

const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
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
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Reverse one current source transition in this repair.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition to reverse.
 */
export const reverseValueIndexTestProfileGapUpdate = (source, update) =>
	reverse(source, update, valueIndexTestProfileGapChangedPaths);

/**
 * Reverse one omitted profile-registration transition.
 *
 * @param source - Complete later profile source text.
 * @param update - Authenticated historical transition to reverse.
 */
export const reverseValueIndexTestProfileGapHistoricalUpdate = (source, update) =>
	reverse(source, update, valueIndexTestProfileGapHistoricalPaths);

/**
 * Reconstruct a source before this repair, stopping exactly at a requested
 * digest. Profile history deliberately walks every contiguous omitted state.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact digest at which reconstruction stops.
 */
export const beforeValueIndexTestProfileGapSource = (path, source, expected) => {
	if(typeof source !== "string") return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	if(valueIndexTestProfileGapChangedPaths.includes(path))
	{
		const update = record().updates.find(item => item.path === path);
		if(update?.currentSha256 === digest)
		{
			source = reverseValueIndexTestProfileGapUpdate(source, update);
			digest = sha256(source);
			if(digest === expected) return source;
		}
	}
	if(!valueIndexTestProfileGapHistoricalPaths.includes(path)) return source;
	while(true)
	{
		const update = record().historicalTransitions.find(item =>
			item.path === path && item.currentSha256 === digest
		);
		if(!update) return source;
		source = reverseValueIndexTestProfileGapHistoricalUpdate(source, update);
		digest = sha256(source);
		if(digest === expected) return source;
	}
};
