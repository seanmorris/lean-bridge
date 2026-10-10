/**
 * Authenticate Fin alias closure integration without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finAliasClosureHistoryPath = "docs/evidence/fin-alias-closure-source-history-20261010.json";
export const finAliasClosurePredecessor = "b8765be7c642fd7ba3349c8cc90a3857a7118b26";
export const finAliasClosureChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-native-hosted-promotion-tests.mjs"
	, "tests/helpers/fin-nominal-refusal-history-tests.mjs"
	, "tests/helpers/fin-nominal-refusal-history.mjs"
	, "tests/helpers/fin-record-zero-ci-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseFinAliasClosureUpdate = (source, update) => {
	assert.ok(finAliasClosureChangedPaths.includes(update.path));
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
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeFinAliasClosureSource = (path, source, expected) => {
	if(typeof source !== "string" || !finAliasClosureChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finAliasClosureHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinAliasClosureUpdate(source, update) : source;
};
