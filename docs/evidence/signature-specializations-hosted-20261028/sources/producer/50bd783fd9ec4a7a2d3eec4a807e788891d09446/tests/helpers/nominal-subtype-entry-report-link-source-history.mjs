/**
 * Reverse the nominal Subtype entry report/link-manifest authentication.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypeEntryReportLinkHistoryPath
	= "docs/evidence/nominal-subtype-entry-report-link-source-history-20261024.json";
export const nominalSubtypeEntryReportLinkPredecessor
	= "98820709dde31ec61482aea6378b95e2ad7adf73";
export const nominalSubtypeEntryReportLinkImplementation
	= "cb729fb13ebe3d54e8ac1c7af0b5022cb19c5a7b";
export const nominalSubtypeEntryReportLinkChangedPaths = Object.freeze([
	"tests/helpers/nominal-subtype-entry-tests.mjs"
	, "tests/helpers/nominal-subtype-entry.mjs"
]);
export const nominalSubtypeEntryReportLinkIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const nominalSubtypeEntryReportLinkNormalizationPaths = Object.freeze([
	...nominalSubtypeEntryReportLinkChangedPaths
	, ...nominalSubtypeEntryReportLinkIntegrationPaths
]);
export const nominalSubtypeEntryReportLinkAddedPaths = Object.freeze([
	"scripts/update-nominal-subtype-entry-report-link-source-history.mjs"
	, "tests/helpers/nominal-subtype-entry-report-link-source-history-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-report-link-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nominalSubtypeEntryReportLinkHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reverseNominalSubtypeEntryReportLinkUpdate = (source, update) => {
	assert.ok(nominalSubtypeEntryReportLinkNormalizationPaths
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
 * Remove only the exact report/link-manifest authentication.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeNominalSubtypeEntryReportLinkSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nominalSubtypeEntryReportLinkNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseNominalSubtypeEntryReportLinkUpdate(source, update);
};
