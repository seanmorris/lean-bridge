/**
 * Authenticate the inherited checked-record documentation correction as one
 * exact, reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordDocsClosureHistoryPath
	= "docs/evidence/inherited-checked-record-docs-closure-source-history-20261018.json";
export const inheritedCheckedRecordDocsClosurePredecessor
	= "eedf89a7a2ba05e5c3a442660ff80dd5564fd51a";
export const inheritedCheckedRecordDocsClosureDraftParent
	= "eedf89a7a2ba05e5c3a442660ff80dd5564fd51a";
export const inheritedCheckedRecordDocsClosureChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
]);
export const inheritedCheckedRecordDocsClosureAddedPaths = Object.freeze([
	"scripts/update-inherited-checked-record-docs-closure-source-history.mjs"
	, "tests/helpers/inherited-checked-record-docs-closure-source-history.mjs"
	, "tests/helpers/inherited-checked-record-docs-closure-source-history-tests.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordDocsClosureHistoryPath, "utf8"
));

/**
 * Reverse one exact documentation-closure transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordDocsClosureUpdate = (
	source, update
) => {
	assert.ok(inheritedCheckedRecordDocsClosureChangedPaths.includes(
		update.path
	));
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
 * Remove only the exact documentation-closure layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordDocsClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordDocsClosureChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordDocsClosureUpdate(source, update)
		: source;
};
