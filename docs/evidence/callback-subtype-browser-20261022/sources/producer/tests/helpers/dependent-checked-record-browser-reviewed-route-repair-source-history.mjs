/**
 * Reverse the dependent checked-record browser reviewed-route repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordBrowserReviewedRouteRepairHistoryPath
	= "docs/evidence/dependent-checked-record-browser-reviewed-route-repair-source-history-20261023.json";
export const dependentCheckedRecordBrowserReviewedRouteRepairPredecessor
	= "87fc26224b6456b2d16c91d538a14497ab0cf196";
export const dependentCheckedRecordBrowserReviewedRouteRepairImplementation
	= "f43a548e34bc1c4090c0dfc82af292e762fb835c";
export const dependentCheckedRecordBrowserReviewedRouteRepairChangedPaths
	= Object.freeze([
		"tests/fixtures/dependent-checked-record-browser/browser.mjs"
		, "tests/helpers/dependent-checked-record-browser-tests.mjs"
	]);
export const dependentCheckedRecordBrowserReviewedRouteRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const dependentCheckedRecordBrowserReviewedRouteRepairNormalizationPaths
	= Object.freeze([
		...dependentCheckedRecordBrowserReviewedRouteRepairChangedPaths
		, ...dependentCheckedRecordBrowserReviewedRouteRepairIntegrationPaths
	]);
export const dependentCheckedRecordBrowserReviewedRouteRepairAddedPaths
	= Object.freeze([
		"scripts/update-dependent-checked-record-browser-reviewed-route-repair-source-history.mjs"
		, "tests/helpers/dependent-checked-record-browser-reviewed-route-repair-source-history-tests.mjs"
		, "tests/helpers/dependent-checked-record-browser-reviewed-route-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordBrowserReviewedRouteRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact reviewed-route repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordBrowserReviewedRouteRepairUpdate = (
	source, update
) => {
	assert.ok(dependentCheckedRecordBrowserReviewedRouteRepairNormalizationPaths
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
 * Remove only the exact reviewed-route repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordBrowserReviewedRouteRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentCheckedRecordBrowserReviewedRouteRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseDependentCheckedRecordBrowserReviewedRouteRepairUpdate(
			source, update
		)
		: source;
};
