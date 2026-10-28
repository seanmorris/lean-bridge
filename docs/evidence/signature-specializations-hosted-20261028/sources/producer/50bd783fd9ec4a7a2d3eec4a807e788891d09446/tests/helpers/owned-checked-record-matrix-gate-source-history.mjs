/**
 * Authenticate the complete owned checked-record matrix gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordMatrixGateHistoryPath
	= "docs/evidence/owned-checked-record-matrix-gate-source-history-20261024.json";
export const ownedCheckedRecordMatrixGatePredecessor
	= "9bd04e4818deb256a85c15c6e90d26bc31a48fa9";
export const ownedCheckedRecordMatrixGateImplementation
	= "a35aa8462d39403310ad8027d0867d53bc21a912";
export const ownedCheckedRecordMatrixGateIntegrationBase
	= "a35aa8462d39403310ad8027d0867d53bc21a912";
export const ownedCheckedRecordMatrixGateCommits = Object.freeze([
	"a35aa8462d39403310ad8027d0867d53bc21a912"
]);
export const ownedCheckedRecordMatrixGateChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/contributing/testing.md"
]);
export const ownedCheckedRecordMatrixGateImplementationAddedPaths = Object.freeze([
	"scripts/check-owned-checked-record-matrix.mjs"
	, "tests/helpers/owned-checked-record-hosted-matrix.mjs"
	, "tests/helpers/owned-checked-record-hosted-matrix-tests.mjs"
]);
export const ownedCheckedRecordMatrixGateImplementationPaths = Object.freeze([
	...ownedCheckedRecordMatrixGateChangedPaths
	, ...ownedCheckedRecordMatrixGateImplementationAddedPaths
]);
export const ownedCheckedRecordMatrixGateIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedRecordMatrixGateNormalizationPaths = Object.freeze([
	...ownedCheckedRecordMatrixGateChangedPaths
	, ...ownedCheckedRecordMatrixGateIntegrationPaths
]);
export const ownedCheckedRecordMatrixGateHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-record-matrix-gate-source-history.mjs"
	, "tests/helpers/owned-checked-record-matrix-gate-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-matrix-gate-source-history.mjs"
]);
export const ownedCheckedRecordMatrixGateAddedPaths = Object.freeze([
	...ownedCheckedRecordMatrixGateImplementationAddedPaths
	, ...ownedCheckedRecordMatrixGateHistoryAddedPaths
]);
export const ownedCheckedRecordMatrixGatePins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "6c1a59dbc2731390baa936c5776b2418c29f78678e7b9f7633fc97252919e1b1"
		, currentSha256: "c83070b2b2160ebced563fd46a4e6e849c7690143472954b87d0c936f96a9929"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordMatrixGateHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedRecordMatrixGateUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedRecordMatrixGateNormalizationPaths
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
 * Remove only the exact Owned checked-record matrix gate.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordMatrixGateSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordMatrixGateNormalizationPaths.includes(path))
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
		current = reverseOwnedCheckedRecordMatrixGateUpdate(current, update);
	}
	return current;
};
