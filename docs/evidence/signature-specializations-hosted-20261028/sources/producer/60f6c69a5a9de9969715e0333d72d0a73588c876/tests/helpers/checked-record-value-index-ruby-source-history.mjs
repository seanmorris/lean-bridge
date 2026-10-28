/**
 * Preserve the Ruby value-index test registration without rewriting older
 * evidence that predates this still-unaccepted host lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexRubyHistoryPath
	= "docs/evidence/checked-record-value-index-ruby-foundation-source-history-20261020.json";
export const checkedRecordValueIndexRubyPredecessor
	= "4d813e8a9da8f81d6801869c09e0e5302496c452";
export const checkedRecordValueIndexRubyDraftParent
	= "787934fa5391427195a49fb2c3e3f855dba64a1f";
export const checkedRecordValueIndexRubyChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexRubyHistoryAddedPaths = Object.freeze([
	"scripts/update-checked-record-value-index-ruby-source-history.mjs"
	, "tests/helpers/checked-record-value-index-ruby-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-ruby-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexRubyHistoryPath, "utf8"
));

/**
 * Reverse one exact Ruby value-index registration transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for one registered source.
 */
export const reverseCheckedRecordValueIndexRubyUpdate = (source, update) => {
	assert.ok(checkedRecordValueIndexRubyChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this Ruby foundation layer, leaving older source-history layers
 * to reconstruct their own predecessors.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCheckedRecordValueIndexRubySource = (path, source, expected) => {
	if(typeof source !== "string" || !checkedRecordValueIndexRubyChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexRubyUpdate(source, update) : source;
};
