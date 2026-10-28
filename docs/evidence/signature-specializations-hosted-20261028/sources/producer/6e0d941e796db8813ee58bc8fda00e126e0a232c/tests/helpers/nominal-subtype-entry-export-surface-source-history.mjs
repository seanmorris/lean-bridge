/**
 * Reverse the nominal Subtype entry export-surface repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypeEntryExportSurfaceHistoryPath
	= "docs/evidence/nominal-subtype-entry-export-surface-source-history-20261024.json";
export const nominalSubtypeEntryExportSurfacePredecessor
	= "cb70f9c90303af391e2374e0b6d6aa794a025812";
export const nominalSubtypeEntryExportSurfaceImplementation
	= "9be0d1e79410e17cb389438463b180785db17d57";
export const nominalSubtypeEntryExportSurfaceChangedPaths = Object.freeze([
	"tests/helpers/nominal-subtype-entry-npm-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-npm.mjs"
	, "tests/helpers/nominal-subtype-entry-tests.mjs"
	, "tests/helpers/nominal-subtype-entry.mjs"
]);
export const nominalSubtypeEntryExportSurfaceIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const nominalSubtypeEntryExportSurfaceNormalizationPaths = Object.freeze([
	...nominalSubtypeEntryExportSurfaceChangedPaths
	, ...nominalSubtypeEntryExportSurfaceIntegrationPaths
]);
export const nominalSubtypeEntryExportSurfaceAddedPaths = Object.freeze([
	"scripts/update-nominal-subtype-entry-export-surface-source-history.mjs"
	, "tests/helpers/nominal-subtype-entry-export-surface-source-history-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-export-surface-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nominalSubtypeEntryExportSurfaceHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reverseNominalSubtypeEntryExportSurfaceUpdate = (
	source, update
) => {
	assert.ok(nominalSubtypeEntryExportSurfaceNormalizationPaths
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
 * Remove only the exact nominal Subtype entry export-surface repair.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeNominalSubtypeEntryExportSurfaceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nominalSubtypeEntryExportSurfaceNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseNominalSubtypeEntryExportSurfaceUpdate(source, update);
};
