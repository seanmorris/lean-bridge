/**
 * Authenticate the released-resource test correction without changing runtime semantics.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRetainedIdentityHistoryPath
	= "docs/evidence/owned-checked-retained-identity-source-history-20261025.json";
export const ownedCheckedRetainedIdentityPredecessor
	= "8d61534c178feedb831fc48041e327caa1f56dbc";
export const ownedCheckedRetainedIdentityImplementation
	= "fc834d89d38057616934d3b43ac327807e4d8c8b";
export const ownedCheckedRetainedIdentityIntegrationBase
	= "fc834d89d38057616934d3b43ac327807e4d8c8b";
export const ownedCheckedRetainedIdentityCommits = Object.freeze([
	"fc834d89d38057616934d3b43ac327807e4d8c8b"
]);
export const ownedCheckedRetainedIdentityChangedPaths = Object.freeze([
	"tests/fixtures/structured-types/owned-checked-record-installed.c"
]);
export const ownedCheckedRetainedIdentityImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-retained-identity-20261025.json"
]);
export const ownedCheckedRetainedIdentityImplementationPaths = Object.freeze([
	...ownedCheckedRetainedIdentityChangedPaths
	, ...ownedCheckedRetainedIdentityImplementationAddedPaths
]);
export const ownedCheckedRetainedIdentityIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedRetainedIdentityNormalizationPaths = Object.freeze([
	...ownedCheckedRetainedIdentityChangedPaths
	, ...ownedCheckedRetainedIdentityIntegrationPaths
]);
export const ownedCheckedRetainedIdentityHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-retained-identity-source-history.mjs"
	, "tests/helpers/owned-checked-retained-identity-source-history-tests.mjs"
	, "tests/helpers/owned-checked-retained-identity-source-history.mjs"
]);
export const ownedCheckedRetainedIdentityAddedPaths = Object.freeze([
	...ownedCheckedRetainedIdentityImplementationAddedPaths
	, ...ownedCheckedRetainedIdentityHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRetainedIdentityHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedRetainedIdentityUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedRetainedIdentityNormalizationPaths
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
 * Remove only the exact Owned checked retained identity.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedRetainedIdentitySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRetainedIdentityNormalizationPaths.includes(path))
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
		current = reverseOwnedCheckedRetainedIdentityUpdate(current, update);
	}
	return current;
};
