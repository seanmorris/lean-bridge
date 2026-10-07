/**
 * Preserve exact source predecessors of the Refinement core follow-up change (#1435).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const refinementCoreFollowupHistoryPath = "docs/evidence/refinement-core-followup-source-history-20261007.json";
export const refinementCoreFollowupChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/generic-records.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/generic-record-specialization-source-history-tests.mjs"
	, "tests/helpers/generic-record-specialization-source-history.mjs"
	, "tests/helpers/php-recursive-callable-evidence.mjs"
	, "tests/php-recursive-callable-evidence.test.mjs"
	, "tests/python-structured-callable-contract.test.mjs"
	, "tests/ruby-structured-callable-contract.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseRefinementCoreFollowupUpdate = (source, update) => {
	assert.ok(refinementCoreFollowupChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore the source before #1435, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRefinementCoreFollowupSource = (path, source, expected) => {
	if(typeof source !== "string" || !refinementCoreFollowupChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(refinementCoreFollowupHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseRefinementCoreFollowupUpdate(source, update) : source;
};
