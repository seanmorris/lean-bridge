/**
 * Reverse the explicit Generic archive boundary repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeArchiveBoundaryHistoryPath
	= "docs/evidence/generic-subtype-archive-boundary-source-history-20261024.json";
export const genericSubtypeArchiveBoundaryPredecessor
	= "c506aadba5209e2b76fee794897a2db0d23d814f";
export const genericSubtypeArchiveBoundaryImplementation
	= "11cdd43393d39e76208d4e729f4d8bddd93d21df";
export const genericSubtypeArchiveBoundaryIntegrationBase
	= "11cdd43393d39e76208d4e729f4d8bddd93d21df";
export const genericSubtypeArchiveBoundaryCommits = Object.freeze([
	"11cdd43393d39e76208d4e729f4d8bddd93d21df"
]);
export const genericSubtypeArchiveBoundaryChangedPaths = Object.freeze([
	"tests/helpers/checked-record-value-index-hosted-archive.mjs"
	, "tests/helpers/generic-subtype-hosted-output.mjs"
	, "tests/helpers/generic-subtype-promotion-tests.mjs"
	, "tests/helpers/generic-subtype-promotion.mjs"
]);
export const genericSubtypeArchiveBoundaryImplementationAddedPaths = Object.freeze([
	"tests/helpers/generic-subtype-archive-boundary-tests.mjs"
]);
export const genericSubtypeArchiveBoundaryImplementationPaths = Object.freeze([
	...genericSubtypeArchiveBoundaryChangedPaths
	, ...genericSubtypeArchiveBoundaryImplementationAddedPaths
]);
export const genericSubtypeArchiveBoundaryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const genericSubtypeArchiveBoundaryNormalizationPaths = Object.freeze([
	...genericSubtypeArchiveBoundaryChangedPaths
	, ...genericSubtypeArchiveBoundaryIntegrationPaths
]);
export const genericSubtypeArchiveBoundaryHistoryAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-archive-boundary-source-history.mjs"
	, "tests/helpers/generic-subtype-archive-boundary-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-archive-boundary-source-history.mjs"
]);
export const genericSubtypeArchiveBoundaryAddedPaths = Object.freeze([
	...genericSubtypeArchiveBoundaryImplementationAddedPaths
	, ...genericSubtypeArchiveBoundaryHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeArchiveBoundaryHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypeArchiveBoundaryUpdate = (
	source, update
) => {
	assert.ok(genericSubtypeArchiveBoundaryNormalizationPaths
		.includes(update.path));
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
 * Remove only the exact Generic archive boundary repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeGenericSubtypeArchiveBoundarySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !genericSubtypeArchiveBoundaryNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseGenericSubtypeArchiveBoundaryUpdate(current, update);
	}
	return current;
};
