/**
 * Authenticate isolated, bounded-disk replay of the owned hosted matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedMatrixIsolationHistoryPath
	= "docs/evidence/owned-matrix-isolation-source-history-20261025.json";
export const ownedMatrixIsolationPredecessor
	= "2b876ce4326265099d04d427c55cb9f20c7a6ebb";
export const ownedMatrixIsolationImplementation
	= "d768942c5a38aa9907dfc98101418876d8040343";
export const ownedMatrixIsolationIntegrationBase
	= "d768942c5a38aa9907dfc98101418876d8040343";
export const ownedMatrixIsolationCommits = Object.freeze([
	"d768942c5a38aa9907dfc98101418876d8040343"
]);
export const ownedMatrixIsolationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/owned-checked-record-hosted-matrix-tests.mjs"
	, "tests/helpers/owned-checked-record-hosted-matrix.mjs"
]);
export const ownedMatrixIsolationImplementationAddedPaths = Object.freeze([]);
export const ownedMatrixIsolationImplementationPaths = Object.freeze([
	...ownedMatrixIsolationChangedPaths
	, ...ownedMatrixIsolationImplementationAddedPaths
]);
export const ownedMatrixIsolationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedMatrixIsolationNormalizationPaths = Object.freeze([
	...ownedMatrixIsolationChangedPaths
	, ...ownedMatrixIsolationIntegrationPaths
]);
export const ownedMatrixIsolationHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-matrix-isolation-source-history.mjs"
	, "tests/helpers/owned-matrix-isolation-source-history-tests.mjs"
	, "tests/helpers/owned-matrix-isolation-source-history.mjs"
]);
export const ownedMatrixIsolationAddedPaths = Object.freeze([
	...ownedMatrixIsolationImplementationAddedPaths
	, ...ownedMatrixIsolationHistoryAddedPaths
]);
export const ownedMatrixIsolationPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/owned-checked-record-hosted-matrix.mjs", count: 11
		, previousSha256: "484c06ad5ca07ec0a56c4e26d49a738f8ef4e9bf17aef7432ff04e7020037400"
		, currentSha256: "6e004e92ee882c3d441ef3d252666ff950477e559af2fb4e34b4e89f84c14c94"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-hosted-matrix-tests.mjs", count: 0
		, previousSha256: "df5b0068a99dc33f8b1ae56eb47d8ae6a89c3c0c0919ef068a8315b61a4ae036"
		, currentSha256: "182954aed1884cb6d51b198808c9639f08a527b7038d3f98c2fd3f24e6987be0"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedMatrixIsolationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedMatrixIsolationUpdate = (
	source, update
) => {
	assert.ok(ownedMatrixIsolationNormalizationPaths
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
 * Remove only the exact Owned matrix isolation.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedMatrixIsolationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedMatrixIsolationNormalizationPaths.includes(path))
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
		current = reverseOwnedMatrixIsolationUpdate(current, update);
	}
	return current;
};
