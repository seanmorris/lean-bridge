/**
 * Authenticate installed .NET checked-record value-index acceptance as one
 * exact, reversible transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexDotnetInstalledHistoryPath
	= "docs/evidence/checked-record-value-index-dotnet-installed-source-history-20261018.json";
export const checkedRecordValueIndexDotnetInstalledPredecessor
	= "cd2503f690d6619a25afe02b2fd9186a9956ea44";
export const checkedRecordValueIndexDotnetInstalledDraftParent
	= "5828aa16deee385d6562f268f9f3a75ad82a8290";
export const checkedRecordValueIndexDotnetInstalledChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-record-value-index-dotnet.test.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/fixtures/checked-record-value-index-dotnet/dotnet.cs"
	, "tests/helpers/checked-record-value-index-dotnet-fixture-tests.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexDotnetInstalledFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-dotnet-environment-records.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-generators.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-installed-static-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-installed-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-model-records.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-package-records.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-package.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-probe-records.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-probe.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-report.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-restore-records.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-runtime-records.mjs"
	]);
export const checkedRecordValueIndexDotnetInstalledHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-dotnet-installed-source-history.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-installed-source-history.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-installed-source-history-tests.mjs"
	]);
export const checkedRecordValueIndexDotnetInstalledAddedPaths = Object.freeze([
	...checkedRecordValueIndexDotnetInstalledFoundationAddedPaths
	, ...checkedRecordValueIndexDotnetInstalledHistoryAddedPaths
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexDotnetInstalledHistoryPath, "utf8"
));

/**
 * Reverse one exact installed .NET value-index transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexDotnetInstalledUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexDotnetInstalledChangedPaths.includes(
		update.path
	));
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
 * Remove only the exact installed .NET value-index acceptance layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexDotnetInstalledSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexDotnetInstalledChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexDotnetInstalledUpdate(source, update)
		: source;
};
