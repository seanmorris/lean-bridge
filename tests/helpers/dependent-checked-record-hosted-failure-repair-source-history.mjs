/**
 * Reverse the JavaScript validator and native diagnostic repairs exposed by
 * the first hosted dependent checked-record runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordHostedFailureRepairHistoryPath
	= "docs/evidence/dependent-checked-record-hosted-failure-repair-source-history-20261021.json";
export const dependentCheckedRecordHostedFailureRepairPredecessor
	= "b41914253d02129f0d88e3473f1df7d68b616cd4";
export const dependentCheckedRecordHostedFailureRepairBrowserImplementation
	= "15f0f577cee0d9b533d23131b9fdc59035622feb";
export const dependentCheckedRecordHostedFailureRepairNativeImplementation
	= "af36107a1b8862d848578865bd6e25c7d9f8be88";
export const dependentCheckedRecordHostedFailureRepairBrowserPaths
	= Object.freeze([
		"src/backends/javascript/generate.mjs"
		, "tests/helpers/dependent-checked-record-browser-tests.mjs"
	]);
export const dependentCheckedRecordHostedFailureRepairNativePaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-native-fixture.mjs"
		, "tests/helpers/dependent-checked-record-native-tests.mjs"
	]);
export const dependentCheckedRecordHostedFailureRepairChangedPaths
	= Object.freeze([
		...dependentCheckedRecordHostedFailureRepairBrowserPaths
		, ...dependentCheckedRecordHostedFailureRepairNativePaths
	]);
export const dependentCheckedRecordHostedFailureRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordHostedFailureRepairHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact repair transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordHostedFailureRepairUpdate = (
	source, update
) => {
	assert.ok([
		...dependentCheckedRecordHostedFailureRepairChangedPaths
		, ...dependentCheckedRecordHostedFailureRepairIntegrationPaths
	].includes(update.path), update.path);
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
 * Remove only these two exact hosted-failure repairs.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordHostedFailureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![
		...dependentCheckedRecordHostedFailureRepairChangedPaths
		, ...dependentCheckedRecordHostedFailureRepairIntegrationPaths
	].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseDependentCheckedRecordHostedFailureRepairUpdate(source, update)
		: source;
};
