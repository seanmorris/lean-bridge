/**
 * Preserve the repair that makes the value-index matrix pin verifier inspect
 * its authenticated historical inventory instead of today's expanded one.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexMatrixHistoricalInventoryRepairHistoryPath
	= "docs/evidence/value-index-matrix-historical-inventory-repair-source-history-20261023.json";
export const valueIndexMatrixHistoricalInventoryRepairPredecessor
	= "1b94f2be1f511c9dbcabd27abb8b169c4a358b3e";
export const valueIndexMatrixHistoricalInventoryRepairImplementation
	= "2b8b73c9d635e13f6407d00909870689cde40431";
export const valueIndexMatrixHistoricalInventoryRepairModifiedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-matrix-pin-repair-source-history-tests.mjs"
	]);
export const valueIndexMatrixHistoricalInventoryRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const valueIndexMatrixHistoricalInventoryRepairNormalizationPaths
	= Object.freeze([...new Set([
		...valueIndexMatrixHistoricalInventoryRepairModifiedPaths
		, ...valueIndexMatrixHistoricalInventoryRepairIntegrationPaths
	])]);
export const valueIndexMatrixHistoricalInventoryRepairAddedPaths
	= Object.freeze([
		"scripts/update-value-index-matrix-historical-inventory-repair-source-history.mjs"
		, "tests/helpers/value-index-matrix-historical-inventory-repair-source-history-tests.mjs"
		, "tests/helpers/value-index-matrix-historical-inventory-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	valueIndexMatrixHistoricalInventoryRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseValueIndexMatrixHistoricalInventoryRepairUpdate = (
	source, update
) => {
	assert.ok(valueIndexMatrixHistoricalInventoryRepairNormalizationPaths
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
 * Remove only the authenticated historical-inventory repair layers.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeValueIndexMatrixHistoricalInventoryRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !valueIndexMatrixHistoricalInventoryRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	const value = record();
	for(const update of [...value.integrationUpdates, ...value.updates])
	{
		if(sha256(current) === expected) break;
		if(update.path === path && update.currentSha256 === sha256(current))
			current = reverseValueIndexMatrixHistoricalInventoryRepairUpdate(
				current, update);
	}
	return current;
};
