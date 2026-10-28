/**
 * Authenticate the previously unrecorded dependent-matrix documentation gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentMatrixDocGateHistoryPath
	= "docs/evidence/dependent-matrix-doc-gate-source-history-20261025.json";
export const dependentMatrixDocGatePredecessor
	= "f601af865a137e60f9a62f0ec9bdc6ec2debc6dc";
export const dependentMatrixDocGateImplementation
	= "6ca01c96fe3960a54e6709768caea7464c1adc6a";
export const dependentMatrixDocGateIntegrationBase
	= "1a5c98c1ab02b710ac79b0b688b72e7a28ef406f";
export const dependentMatrixDocGateCommits = Object.freeze([
	"89c6f207deed48755bd46b9b1f161d5a3e8da4ee"
	, "6ca01c96fe3960a54e6709768caea7464c1adc6a"
]);
export const dependentMatrixDocGateChangedPaths = Object.freeze([
	".github/workflows/dependent-checked-record-matrix.yml"
	, "tests/dependent-checked-record-matrix-inventory.test.mjs"
	, "tests/helpers/dependent-checked-record-matrix-ci-tests.mjs"
]);
export const dependentMatrixDocGateImplementationAddedPaths = Object.freeze([]);
export const dependentMatrixDocGateImplementationPaths = Object.freeze([
	...dependentMatrixDocGateChangedPaths
	, ...dependentMatrixDocGateImplementationAddedPaths
]);
export const dependentMatrixDocGateIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const dependentMatrixDocGateNormalizationPaths = Object.freeze([
	...dependentMatrixDocGateChangedPaths
	, ...dependentMatrixDocGateIntegrationPaths
]);
export const dependentMatrixDocGateHistoryAddedPaths = Object.freeze([
	"scripts/update-dependent-matrix-doc-gate-source-history.mjs"
	, "tests/helpers/dependent-matrix-doc-gate-source-history-tests.mjs"
	, "tests/helpers/dependent-matrix-doc-gate-source-history.mjs"
]);
export const dependentMatrixDocGateAddedPaths = Object.freeze([
	...dependentMatrixDocGateImplementationAddedPaths
	, ...dependentMatrixDocGateHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentMatrixDocGateHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseDependentMatrixDocGateUpdate = (
	source, update
) => {
	assert.ok(dependentMatrixDocGateNormalizationPaths
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
 * Remove only the exact Dependent matrix doc gate.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeDependentMatrixDocGateSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentMatrixDocGateNormalizationPaths.includes(path))
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
		current = reverseDependentMatrixDocGateUpdate(current, update);
	}
	return current;
};
