/**
 * Authenticate the hosted value-index checked-record .NET archive and its
 * source pins as one exact, reversible transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexDotnetArchiveHistoryPath
	= "docs/evidence/checked-record-value-index-dotnet-archive-source-history-20261018.json";
export const checkedRecordValueIndexDotnetArchivePredecessor
	= "48bf81cd13da3c526d6ad7f37cb968e5a5a4a948";
export const checkedRecordValueIndexDotnetArchiveDraftParent
	= "d86bdb9ff4cb742befce1b19618667f846bab3d6";
export const checkedRecordValueIndexDotnetArchiveRoot
	= "docs/evidence/checked-record-value-index-dotnet-20261018";
export const checkedRecordValueIndexDotnetArchiveIndexSha256
	= "56b823c66218e714bf625b9da1760ca4bee04791d0350aa939f51feeb3453dca";
export const checkedRecordValueIndexDotnetArchiveAttributesSha256
	= "9b114a24d4773d5a92b192c92b0256d72c82162ee2e15dd1fa90568d85627024";
export const checkedRecordValueIndexDotnetArchiveIndexedFileCount = 1088;
export const checkedRecordValueIndexDotnetArchiveAddedFileCount = 1090;
export const checkedRecordValueIndexDotnetArchiveFoundationModifiedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-dotnet-evidence.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-provenance.mjs"
	]);
export const checkedRecordValueIndexDotnetArchiveChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, ...checkedRecordValueIndexDotnetArchiveFoundationModifiedPaths
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexDotnetArchiveHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-dotnet-archive-source-history.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-archive-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-archive-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexDotnetArchiveHistoryPath, "utf8"
));

/**
 * Reverse one exact .NET archive transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexDotnetArchiveUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexDotnetArchiveChangedPaths.includes(
		update.path));
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
 * Remove only the exact hosted .NET archive layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexDotnetArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexDotnetArchiveChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexDotnetArchiveUpdate(source, update)
		: source;
};
