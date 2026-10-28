/**
 * Authenticate the generic Subtype compact reference promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeCompactReferenceHistoryPath
	= "docs/evidence/generic-subtype-compact-reference-source-history-20261024.json";
export const genericSubtypeCompactReferencePredecessor
	= "6abd65895becbd1c4787d853af5e5fd9e80954ec";
export const genericSubtypeCompactReferenceImplementation
	= "b3f066360ef51e57f625de90f0206011e15e8719";
export const genericSubtypeCompactReferenceIntegrationBase
	= "b3f066360ef51e57f625de90f0206011e15e8719";
export const genericSubtypeCompactReferenceCommits = Object.freeze([
	"b3f066360ef51e57f625de90f0206011e15e8719"
]);
export const genericSubtypeCompactReferenceChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/contributing/testing.md"
	, "tests/helpers/generic-subtype-promotion.mjs"
	, "tests/helpers/generic-subtype-archive-boundary-tests.mjs"
]);
export const genericSubtypeCompactReferenceImplementationAddedPaths = Object.freeze([]);
export const genericSubtypeCompactReferenceImplementationPaths = Object.freeze([
	...genericSubtypeCompactReferenceChangedPaths
	, ...genericSubtypeCompactReferenceImplementationAddedPaths
]);
export const genericSubtypeCompactReferenceIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const genericSubtypeCompactReferenceNormalizationPaths = Object.freeze([
	...genericSubtypeCompactReferenceChangedPaths
	, ...genericSubtypeCompactReferenceIntegrationPaths
]);
export const genericSubtypeCompactReferenceHistoryAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-compact-reference-source-history.mjs"
	, "tests/helpers/generic-subtype-compact-reference-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-compact-reference-source-history.mjs"
]);
export const genericSubtypeCompactReferenceAddedPaths = Object.freeze([
	...genericSubtypeCompactReferenceImplementationAddedPaths
	, ...genericSubtypeCompactReferenceHistoryAddedPaths
]);
export const genericSubtypeCompactReferencePins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "acd21552e997b7003de081b9764281cf9f101b0a27ff473e77be221647779d96"
		, currentSha256: "5ef920ff619dbd6488d006a1d922264d3c0d405e0969fa4caa2c683c9adbd657"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeCompactReferenceHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypeCompactReferenceUpdate = (
	source, update
) => {
	assert.ok(genericSubtypeCompactReferenceNormalizationPaths
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
 * Remove only the exact Generic Subtype compact reference promotion.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeGenericSubtypeCompactReferenceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !genericSubtypeCompactReferenceNormalizationPaths.includes(path))
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
		current = reverseGenericSubtypeCompactReferenceUpdate(current, update);
	}
	return current;
};
