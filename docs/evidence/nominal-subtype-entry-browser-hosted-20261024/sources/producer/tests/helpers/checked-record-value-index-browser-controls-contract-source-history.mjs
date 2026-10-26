/**
 * Reverse the explicit live-versus-archived value-index browser controls
 * contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexBrowserControlsContractHistoryPath
	= "docs/evidence/checked-record-value-index-browser-controls-contract-source-history-20261024.json";
export const checkedRecordValueIndexBrowserControlsContractPredecessor
	= "73353dd7e6c92f9a5be833af88161197235cc99b";
export const checkedRecordValueIndexBrowserControlsContractImplementation
	= "db270b36999019f0d78120ba17605f32b01d048f";
export const checkedRecordValueIndexBrowserControlsContractChangedPaths
	= Object.freeze([
		"scripts/archive-checked-record-value-index-browser-evidence.mjs"
		, "scripts/check-checked-record-value-index-browser-ci.mjs"
		, "tests/helpers/checked-record-value-index-browser-ci-report.mjs"
		, "tests/helpers/checked-record-value-index-browser-evidence.mjs"
		, "tests/helpers/checked-record-value-index-browser-tests.mjs"
	]);
export const checkedRecordValueIndexBrowserControlsContractIntegrationPaths
	= Object.freeze([
		"tests/checked-record-value-index-browser.test.mjs"
		, "tests/helpers/checked-record-value-index-browser-archive-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexBrowserControlsContractNormalizationPaths
	= Object.freeze([
		...checkedRecordValueIndexBrowserControlsContractChangedPaths
		, ...checkedRecordValueIndexBrowserControlsContractIntegrationPaths
	]);
export const checkedRecordValueIndexBrowserControlsContractAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-browser-controls-contract-source-history.mjs"
		, "tests/helpers/checked-record-value-index-browser-controls-contract-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-browser-controls-contract-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexBrowserControlsContractHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both complete endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reverseCheckedRecordValueIndexBrowserControlsContractUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexBrowserControlsContractNormalizationPaths
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
 * Remove only the exact explicit-controls transition recognized by the
 * authenticated history record.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexBrowserControlsContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexBrowserControlsContractNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCheckedRecordValueIndexBrowserControlsContractUpdate(
			source, update);
};
