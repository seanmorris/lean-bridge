/**
 * Preserve the value-index Perl Core registration and its later live-pin
 * repair without rewriting the registration commit or older evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPerlHistoryPath
	= "docs/evidence/checked-record-value-index-perl-source-history-20261019.json";
export const checkedRecordValueIndexPerlPredecessor
	= "ab5a5c8fc2a045e884c30bcb7ef582d64c155c58";
export const checkedRecordValueIndexPerlDraftParent
	= "ab5a5c8fc2a045e884c30bcb7ef582d64c155c58";
export const checkedRecordValueIndexPerlChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-record-value-index-perl.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexPerlHistoricalPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
]);
export const checkedRecordValueIndexPerlAddedPaths = Object.freeze([
	"scripts/update-checked-record-value-index-perl-source-history.mjs"
	, "tests/helpers/checked-record-value-index-perl-source-history.mjs"
	, "tests/helpers/checked-record-value-index-perl-source-history-tests.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPerlHistoryPath, "utf8"
));

const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path));
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
 * Reverse the current source-history integration and live-pin repair.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexPerlUpdate = (source, update) =>
	reverse(source, update, checkedRecordValueIndexPerlChangedPaths);

/**
 * Reverse the original Core profile-registration transition.
 *
 * @param source - Complete source after the historical transition.
 * @param update - Authenticated historical profile transition.
 */
export const reverseCheckedRecordValueIndexPerlHistoricalUpdate = (
	source, update
) => reverse(source, update, checkedRecordValueIndexPerlHistoricalPaths);

/**
 * Reconstruct the source immediately before value-index Perl registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCheckedRecordValueIndexPerlSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	if(checkedRecordValueIndexPerlChangedPaths.includes(path))
	{
		const update = record().updates.find(item => item.path === path);
		if(update?.currentSha256 === digest)
		{
			source = reverseCheckedRecordValueIndexPerlUpdate(source, update);
			digest = sha256(source);
			if(digest === expected) return source;
		}
	}
	if(!checkedRecordValueIndexPerlHistoricalPaths.includes(path)) return source;
	const update = record().historicalTransitions.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update ? reverseCheckedRecordValueIndexPerlHistoricalUpdate(
		source, update
	) : source;
};
