/**
 * Reverse the authenticated owned-refinement carrier-model transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedRefinementModelHistoryPath
	= "docs/evidence/owned-refinement-model-source-history-20261020.json";
export const ownedRefinementModelPredecessor
	= "f34d7fe555c63889f7344b6a88ebfc17140c8a32";
export const ownedRefinementModelImplementation
	= "4d4c810ab4b8cc64a60286a3ed4d3292d76fda02";
export const ownedRefinementModelChangedPaths = Object.freeze([
	"package.json"
	, "src/abi/README.md"
	, "src/abi/owned-aggregate-model.mjs"
	, "src/build/owned-aggregate-carriers.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/owned-subtype-analysis-source-history-tests.mjs"
	, "tests/owned-aggregate-model.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedRefinementModelHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedRefinementModelUpdate = (source, update) => {
	assert.ok(ownedRefinementModelChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this exact owned-refinement carrier-model transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedRefinementModelSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ownedRefinementModelChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseOwnedRefinementModelUpdate(source, update) : source;
};
