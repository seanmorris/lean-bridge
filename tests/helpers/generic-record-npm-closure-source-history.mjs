/**
 * Preserve exact source predecessors when closing the hosted ordinary npm generic-record acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericNpmClosureHistoryPath = "docs/evidence/generic-record-npm-closure-source-history-20261009.json";
export const genericNpmClosurePredecessor = "5fd19949b5b69d049c922ee5eb2a96efedaf9a79";
export const genericNpmClosureChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/ruby-gdb-ci-source-history.mjs"
	, "tests/helpers/ruby-gdb-ci-source-history-tests.mjs"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, ".gitattributes"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseGenericNpmClosureUpdate = (source, update) => {
	assert.ok(genericNpmClosureChangedPaths.includes(update.path));
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
 * Restore the pre-integration source, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeGenericNpmClosureSource = (path, source, expected) => {
	if(typeof source !== "string" || !genericNpmClosureChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(genericNpmClosureHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseGenericNpmClosureUpdate(source, update) : source;
};
