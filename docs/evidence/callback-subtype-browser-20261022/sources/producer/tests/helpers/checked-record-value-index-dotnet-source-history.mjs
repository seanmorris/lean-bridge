/**
 * Authenticate the static .NET checked-record value-index foundation as one
 * exact, reversible transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexDotnetHistoryPath
	= "docs/evidence/checked-record-value-index-dotnet-source-history-20261018.json";
export const checkedRecordValueIndexDotnetPredecessor
	= "e6fffe186f08fd148c158150104d406561c89e37";
export const checkedRecordValueIndexDotnetDraftParent
	= "58622253b3671a756b458bcb43155bf9e5a28a21";
export const checkedRecordValueIndexDotnetChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexDotnetFoundationAddedPaths = Object.freeze([
	"tests/checked-record-value-index-dotnet.test.mjs"
	, "tests/fixtures/checked-record-value-index-dotnet/dotnet.cs"
	, "tests/helpers/checked-record-value-index-dotnet-fixture-tests.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-fixture.mjs"
]);
export const checkedRecordValueIndexDotnetHistoryAddedPaths = Object.freeze([
	"scripts/update-checked-record-value-index-dotnet-source-history.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-source-history.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-source-history-tests.mjs"
]);
export const checkedRecordValueIndexDotnetAddedPaths = Object.freeze([
	...checkedRecordValueIndexDotnetFoundationAddedPaths
	, ...checkedRecordValueIndexDotnetHistoryAddedPaths
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexDotnetHistoryPath, "utf8"
));

/**
 * Reverse one exact static .NET value-index foundation transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexDotnetUpdate = (source, update) => {
	assert.ok(checkedRecordValueIndexDotnetChangedPaths.includes(update.path));
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
 * Remove only the exact static .NET value-index foundation layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexDotnetSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexDotnetChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexDotnetUpdate(source, update)
		: source;
};
