/**
 * Authenticate the closed registration of inherited checked-record test
 * entrypoints without rewriting any earlier source-history ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordTestRegistrationHistoryPath
	= "docs/evidence/inherited-checked-record-test-registration-source-history-20261017.json";
export const inheritedCheckedRecordTestRegistrationPredecessor
	= "97ac329b3f5627db2c8676bb5a02d506fb57e515";
export const inheritedCheckedRecordTestRegistrationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordTestRegistrationHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record registration transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordTestRegistrationUpdate = (
	source, update
) => {
	assert.ok(inheritedCheckedRecordTestRegistrationChangedPaths.includes(
		update.path));
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
 * Remove only this registration layer and preserve unknown source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional digest at which normalization should stop.
 */
export const beforeInheritedCheckedRecordTestRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordTestRegistrationChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordTestRegistrationUpdate(source, update)
		: source;
};
