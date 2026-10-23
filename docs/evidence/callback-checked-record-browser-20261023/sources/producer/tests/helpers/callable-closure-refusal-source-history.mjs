/**
 * Reverse the authenticated returned-closure refusal-diagnostic layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callableClosureRefusalHistoryPath
	= "docs/evidence/callable-closure-refusal-source-history-20261022.json";
export const callableClosureRefusalPredecessor
	= "a8a6c351f7ea09a91ee2ccbe4b2e15c9bfb450f1";
export const callableClosureRefusalImplementation
	= "d98cb39ef941b13c3af6d0080cf1bf0b9585ca97";
export const callableClosureRefusalUpdatedPaths = Object.freeze([
	"src/abi/component-structured-callables.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/native-callable-graph-calls.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/wit/callable-graph-host.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-structured-callable-lean.mjs"
]);
export const callableClosureRefusalImplementationAdditions = Object.freeze([
	"tests/callable-closure-refusal.test.mjs"
]);
export const callableClosureRefusalImplementationPaths = Object.freeze([
	...callableClosureRefusalUpdatedPaths
	, ...callableClosureRefusalImplementationAdditions
]);
export const callableClosureRefusalIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const callableClosureRefusalChangedPaths = Object.freeze([
	...callableClosureRefusalUpdatedPaths
	, ...callableClosureRefusalIntegrationPaths
]);
export const callableClosureRefusalAddedPaths = Object.freeze([
	...callableClosureRefusalImplementationAdditions
	, "scripts/update-callable-closure-refusal-source-history.mjs"
	, "tests/helpers/callable-closure-refusal-source-history-tests.mjs"
	, "tests/helpers/callable-closure-refusal-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callableClosureRefusalHistoryPath, "utf8"));

/**
 * Restore one exact returned-closure refusal source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallableClosureRefusalUpdate = (source, update) => {
	assert.ok(callableClosureRefusalChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only the exact returned-closure refusal milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallableClosureRefusalSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callableClosureRefusalChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update ? reverseCallableClosureRefusalUpdate(source, update) : source;
};
