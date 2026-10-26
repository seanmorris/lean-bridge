/**
 * Authenticate the .NET result-only and Core inventory repair as one exact,
 * reversible source layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexDotnetResultOnlyCoreRepairHistoryPath
	= "docs/evidence/checked-record-value-index-dotnet-result-only-core-repair-source-history-20261018.json";
export const checkedRecordValueIndexDotnetResultOnlyCoreRepairPredecessor
	= "e054b746803364268b0a052746f7ae439b97972d";
export const checkedRecordValueIndexDotnetResultOnlyCoreRepairDraftParent
	= "0716fff5544296b8e8f8ad0a63741f928cf5f4d4";
export const checkedRecordValueIndexDotnetResultOnlyCoreRepairFoundationPaths
	= Object.freeze([
		"src/adoption/test-profiles.mjs"
		, "tests/fixtures/checked-record-value-index-dotnet/dotnet.cs"
		, "tests/helpers/checked-record-value-index-dotnet-fixture-tests.mjs"
	]);
export const checkedRecordValueIndexDotnetResultOnlyCoreRepairAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-dotnet-result-only-core-repair-source-history.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-result-only-core-repair-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-result-only-core-repair-source-history.mjs"
	]);
export const checkedRecordValueIndexDotnetResultOnlyCoreRepairChangedPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/component-array-contract.test.mjs"
		, ...checkedRecordValueIndexDotnetResultOnlyCoreRepairFoundationPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexDotnetResultOnlyCoreRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact .NET result-only/Core inventory repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexDotnetResultOnlyCoreRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexDotnetResultOnlyCoreRepairChangedPaths
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
 * Remove only the exact .NET result-only/Core inventory repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexDotnetResultOnlyCoreRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexDotnetResultOnlyCoreRepairChangedPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexDotnetResultOnlyCoreRepairUpdate(
			source, update)
		: source;
};
