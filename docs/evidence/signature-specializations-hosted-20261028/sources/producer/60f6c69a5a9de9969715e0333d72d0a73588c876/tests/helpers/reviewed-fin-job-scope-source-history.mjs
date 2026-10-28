/**
 * Preserve the selected-job boundary for reviewed Fin hosted evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const reviewedFinJobScopeHistoryPath
	= "docs/evidence/reviewed-fin-job-scope-source-history-20261028.json";
export const reviewedFinJobScopePredecessor
	= "f31e944d024cd3d1ef6b403e306f1c51cf4a1f7b";
export const reviewedFinJobScopeImplementation
	= "4ce9ba029ff2de9a4d7becf4148572ae5535c342";
export const reviewedFinJobScopeImplementationPaths = Object.freeze([
	"scripts/archive-reviewed-fin-wasm-entry-hosted.mjs"
	, "tests/helpers/reviewed-fin-wasm-entry-hosted-archive.mjs"
]);
export const reviewedFinJobScopeImplementationAddedPaths = Object.freeze([
	"tests/reviewed-fin-wasm-entry-hosted-archive.test.mjs"
]);
export const reviewedFinJobScopeIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const reviewedFinJobScopeIntegrationAddedPaths = Object.freeze([
	"scripts/update-reviewed-fin-job-scope-source-history.mjs"
	, "tests/helpers/reviewed-fin-job-scope-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-job-scope-source-history.mjs"
]);
export const reviewedFinJobScopeAddedPaths = Object.freeze([
	...reviewedFinJobScopeImplementationAddedPaths
	, ...reviewedFinJobScopeIntegrationAddedPaths
]);
export const reviewedFinJobScopeNormalizationPaths = Object.freeze([
	...reviewedFinJobScopeImplementationPaths
	, ...reviewedFinJobScopeIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	reviewedFinJobScopeHistoryPath, "utf8"
));

/**
 * Reverse one exact selected-job evidence transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseReviewedFinJobScopeUpdate = (source, update) => {
	assert.ok(reviewedFinJobScopeNormalizationPaths.includes(update.path));
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated selected-job evidence transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeReviewedFinJobScopeSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !reviewedFinJobScopeNormalizationPaths.includes(path)) return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseReviewedFinJobScopeUpdate(current, update);
	}
	return current;
};
