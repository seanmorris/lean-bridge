/**
 * Reverse the dependent checked-record browser diagnostic-path repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordBrowserPathDiagnosticRepairHistoryPath
	= "docs/evidence/dependent-checked-record-browser-path-diagnostic-repair-source-history-20261022.json";
export const dependentCheckedRecordBrowserPathDiagnosticRepairPredecessor
	= "57a88dd93005bbd8de2097c4aa6d49fc1bf9679a";
export const dependentCheckedRecordBrowserPathDiagnosticRepairImplementation
	= "993a7def382e2908c7579fe8906c9f9416c566ca";
export const dependentCheckedRecordBrowserPathDiagnosticRepairChangedPaths
	= Object.freeze([
		"tests/fixtures/dependent-checked-record-browser/javascript.mjs"
		, "tests/helpers/dependent-checked-record-browser-tests.mjs"
	]);
export const dependentCheckedRecordBrowserPathDiagnosticRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	]);
export const dependentCheckedRecordBrowserPathDiagnosticRepairNormalizationPaths
	= Object.freeze([
		...dependentCheckedRecordBrowserPathDiagnosticRepairChangedPaths
		, ...dependentCheckedRecordBrowserPathDiagnosticRepairIntegrationPaths
	]);
export const dependentCheckedRecordBrowserPathDiagnosticRepairAddedPaths
	= Object.freeze([
		"scripts/update-dependent-checked-record-browser-path-diagnostic-repair-source-history.mjs"
		, "tests/helpers/dependent-checked-record-browser-path-diagnostic-repair-source-history-tests.mjs"
		, "tests/helpers/dependent-checked-record-browser-path-diagnostic-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordBrowserPathDiagnosticRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact browser diagnostic-path transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordBrowserPathDiagnosticRepairUpdate = (
	source, update
) => {
	assert.ok(dependentCheckedRecordBrowserPathDiagnosticRepairNormalizationPaths
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
 * Remove only the exact browser diagnostic-path repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordBrowserPathDiagnosticRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentCheckedRecordBrowserPathDiagnosticRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseDependentCheckedRecordBrowserPathDiagnosticRepairUpdate(
			source, update)
		: source;
};
