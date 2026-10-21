/**
 * Authenticate the value-index browser fixture lint repair as one exact,
 * reversible transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexBrowserLintHistoryPath
	= "docs/evidence/value-index-browser-lint-source-history-20261018.json";
export const valueIndexBrowserLintPredecessor
	= "ec16ecae358d71f83a66ffd59c570a2264d30202";
export const valueIndexBrowserLintDraftParent
	= "518ec61d10d6cac3fa9ecb7a9a7bd9b3c9ac5cc5";
export const valueIndexBrowserLintChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/fixtures/checked-record-value-index-browser/full.mts"
	, "tests/fixtures/checked-record-value-index-browser/result-only.mts"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const valueIndexBrowserLintAddedPaths = Object.freeze([
	"scripts/update-value-index-browser-lint-source-history.mjs"
	, "tests/helpers/value-index-browser-lint-source-history.mjs"
	, "tests/helpers/value-index-browser-lint-source-history-tests.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	valueIndexBrowserLintHistoryPath, "utf8"
));

/**
 * Reverse one exact value-index browser lint transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseValueIndexBrowserLintUpdate = (source, update) => {
	assert.ok(valueIndexBrowserLintChangedPaths.includes(update.path));
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
 * Remove only the exact value-index browser lint repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeValueIndexBrowserLintSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !valueIndexBrowserLintChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseValueIndexBrowserLintUpdate(source, update)
		: source;
};
