/**
 * Authenticate the hosted .NET repair and fail-closed evidence scaffold as one
 * exact reversible source layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexDotnetHostedRepairHistoryPath
	= "docs/evidence/checked-record-value-index-dotnet-hosted-repair-source-history-20261018.json";
export const checkedRecordValueIndexDotnetHostedRepairPredecessor
	= "d44f1a1422b49f1fe973afc37386a42c5ef48d97";
export const checkedRecordValueIndexDotnetHostedRepairDraftParent
	= "99563678017076e9dc640e12e15cbe73d276103c";
export const checkedRecordValueIndexDotnetHostedRepairFoundationModifiedPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-controls.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-environment-records.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-model-records.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-report.mjs"
	]);
export const checkedRecordValueIndexDotnetHostedRepairFoundationAddedPaths
	= Object.freeze([
		"scripts/archive-checked-record-value-index-dotnet-evidence.mjs"
		, "tests/checked-record-value-index-dotnet-evidence.test.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-evidence-sources.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-evidence-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-evidence.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-provenance.mjs"
	]);
export const checkedRecordValueIndexDotnetHostedRepairHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-dotnet-hosted-repair-source-history.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-hosted-repair-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-hosted-repair-source-history.mjs"
	]);
export const checkedRecordValueIndexDotnetHostedRepairAddedPaths
	= Object.freeze([
		...checkedRecordValueIndexDotnetHostedRepairFoundationAddedPaths
		, ...checkedRecordValueIndexDotnetHostedRepairHistoryAddedPaths
	]);
export const checkedRecordValueIndexDotnetHostedRepairChangedPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/component-array-contract.test.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-controls.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-environment-records.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-model-records.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-report.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexDotnetHostedRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted-repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexDotnetHostedRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexDotnetHostedRepairChangedPaths
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
 * Remove only the exact hosted repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexDotnetHostedRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexDotnetHostedRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexDotnetHostedRepairUpdate(source, update)
		: source;
};
