/**
 * Authenticate the checked-record alias admission repair as one exact,
 * reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordAliasAdmissionHistoryPath
	= "docs/evidence/checked-record-alias-admission-source-history-20261017.json";
export const checkedRecordAliasAdmissionPredecessor
	= "2d68d17d7c5e9ff2d87d972d7a16d4e4d9f413cc";
export const checkedRecordAliasAdmissionChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordAliasAdmissionAddedPaths = Object.freeze([
	"scripts/update-checked-record-alias-admission-history.mjs"
	, "tests/checked-record-alias-admission-source-history.test.mjs"
	, "tests/helpers/checked-record-alias-admission-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordAliasAdmissionHistoryPath, "utf8"
));

/**
 * Reverse one exact checked-record alias admission transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordAliasAdmissionUpdate = (
	source, update
) => {
	assert.ok(checkedRecordAliasAdmissionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.replacements !== undefined)
	{
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		for(const replacement of [...update.replacements].reverse())
		{
			assert.equal(typeof replacement.previous, "string");
			assert.equal(typeof replacement.current, "string");
			assert.notEqual(replacement.previous, replacement.current);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.current).length - 1
				, replacement.count, update.path);
			source = source.replaceAll(
				replacement.current, replacement.previous);
		}
		assert.equal(sha256(source), update.previousSha256, update.path);
		return source;
	}
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
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
 * Remove only this alias admission layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordAliasAdmissionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordAliasAdmissionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordAliasAdmissionUpdate(source, update)
		: source;
};
