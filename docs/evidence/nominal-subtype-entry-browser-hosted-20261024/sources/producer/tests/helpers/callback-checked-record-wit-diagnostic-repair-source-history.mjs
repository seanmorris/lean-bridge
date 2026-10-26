/**
 * Reverse the WIT callback checked-record diagnostic-oracle repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordWitDiagnosticRepairHistoryPath
	= "docs/evidence/callback-checked-record-wit-diagnostic-repair-source-history-20261023.json";
export const callbackCheckedRecordWitDiagnosticRepairPredecessor
	= "b0f2458293a60c1b6cd5cad5eb39b4fa29bd131b";
export const callbackCheckedRecordWitDiagnosticRepairImplementation
	= "52848edcf59a22ada4f11fd459a3ea000ef58d62";
export const callbackCheckedRecordWitDiagnosticRepairChangedPaths = Object.freeze([
	"tests/callback-checked-record-native.test.mjs"
	, "tests/fixtures/callback-checked-record-consumers/wit-wasi.c"
]);
export const callbackCheckedRecordWitDiagnosticRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const callbackCheckedRecordWitDiagnosticRepairNormalizationPaths
	= Object.freeze([
		...callbackCheckedRecordWitDiagnosticRepairChangedPaths
		, ...callbackCheckedRecordWitDiagnosticRepairIntegrationPaths
	]);
export const callbackCheckedRecordWitDiagnosticRepairAddedPaths = Object.freeze([
	"scripts/update-callback-checked-record-wit-diagnostic-repair-source-history.mjs"
	, "tests/helpers/callback-checked-record-wit-diagnostic-repair-source-history-tests.mjs"
	, "tests/helpers/callback-checked-record-wit-diagnostic-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordWitDiagnosticRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact WIT callback diagnostic repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackCheckedRecordWitDiagnosticRepairUpdate = (
	source, update
) => {
	assert.ok(callbackCheckedRecordWitDiagnosticRepairNormalizationPaths
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
 * Remove only the exact WIT callback diagnostic repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordWitDiagnosticRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordWitDiagnosticRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackCheckedRecordWitDiagnosticRepairUpdate(source, update)
		: source;
};
