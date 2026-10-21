/**
 * Authenticate escaped reserved member names in copied Ruby records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeRubyGraphKeywordFieldPins
	, beforeRubyGraphKeywordFieldSource
} from "./ruby-graph-keyword-field-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const rubyMemberEscapeHistoryPath
	= "docs/evidence/ruby-member-escape-source-history-20261016.json";
export const rubyMemberEscapePredecessor
	= "efb8a0c8ed4448080eda17eb4c588106c2cd5db1";
export const rubyMemberEscapeDraftParent
	= "efb8a0c8ed4448080eda17eb4c588106c2cd5db1";
export const rubyMemberEscapeChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/backends/ruby/copied-conversions.mjs"
	, "src/backends/ruby/copied-graph-package.mjs"
	, "src/backends/ruby/copied-graph-values.mjs"
	, "src/backends/ruby/copied-model.mjs"
	, "src/backends/ruby/copied-values.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseRubyMemberEscapeUpdate = (source, update) => {
	assert.ok(rubyMemberEscapeChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
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
 * Remove only this Ruby member escape transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutRubyMemberEscape = (path, source) => {
	if(typeof source !== "string"
		|| !rubyMemberEscapeChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		rubyMemberEscapeHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseRubyMemberEscapeUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRubyMemberEscapeSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !rubyMemberEscapeChangedPaths.includes(path))
		return beforeRubyGraphKeywordFieldSource(path, source, expected);
	let digest = sha256(source);
	if(digest === expected) return source;
	const previous = withoutRubyMemberEscape(path, source);
	if(previous !== source)
	{
		source = previous;
		digest = sha256(source);
		if(digest === expected) return source;
	}
	return beforeRubyGraphKeywordFieldSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeRubyMemberEscapePins = inventory => {
	const record = history ??= JSON.parse(readFileSync(
		rubyMemberEscapeHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path
		=== "docs/type-surface.v1.json");
	const current = JSON.stringify(inventory, null, 2) + "\n";
	const previous = update?.currentSha256 === sha256(current)
		? JSON.parse(reverseRubyMemberEscapeUpdate(current, update))
		: structuredClone(inventory);
	return beforeRubyGraphKeywordFieldPins(previous);
};
