/**
 * Authenticate value-index .NET CI controls as one exact reversible layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexDotnetCiHistoryPath
	= "docs/evidence/checked-record-value-index-dotnet-ci-source-history-20261018.json";
export const checkedRecordValueIndexDotnetCiPredecessor
	= "772247ae77d20c972e822b28d827889355bffa49";
export const checkedRecordValueIndexDotnetCiDraftParent
	= "ec64960fc068020279664e1190146562f203b7c9";
export const checkedRecordValueIndexDotnetCiChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-record-value-index-dotnet.test.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/fixtures/checked-record-value-index-dotnet/dotnet.cs"
	, "tests/helpers/checked-record-value-index-dotnet-fixture-tests.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-fixture.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-installed-static-tests.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-installed-tests.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-model-records.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-report.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexDotnetCiFoundationModifiedPaths
	= Object.freeze([
		"tests/checked-record-value-index-dotnet.test.mjs"
		, "tests/fixtures/checked-record-value-index-dotnet/dotnet.cs"
		, "tests/helpers/checked-record-value-index-dotnet-fixture-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-fixture.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-installed-static-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-installed-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-model-records.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-report.mjs"
	]);
export const checkedRecordValueIndexDotnetCiFoundationAddedPaths
	= Object.freeze([
		".github/workflows/checked-record-value-index-dotnet.yml"
		, "scripts/check-checked-record-value-index-dotnet-ci.mjs"
		, "scripts/run-checked-record-value-index-dotnet-ci.sh"
		, "tests/helpers/checked-record-value-index-dotnet-ci-handoff.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-ci-policy-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-ci-report.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-ci-shell-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-ci-tools.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-ci-workflow-tests.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-ci-workflow.mjs"
		, "tests/helpers/checked-record-value-index-dotnet-controls.mjs"
	]);
export const checkedRecordValueIndexDotnetCiHistoryAddedPaths = Object.freeze([
	"scripts/update-checked-record-value-index-dotnet-ci-source-history.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-ci-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-ci-source-history.mjs"
]);
export const checkedRecordValueIndexDotnetCiAddedPaths = Object.freeze([
	...checkedRecordValueIndexDotnetCiFoundationAddedPaths
	, ...checkedRecordValueIndexDotnetCiHistoryAddedPaths
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexDotnetCiHistoryPath, "utf8"
));

/**
 * Reverse one exact value-index .NET CI transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexDotnetCiUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexDotnetCiChangedPaths.includes(update.path));
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
 * Remove only the exact value-index .NET CI controls layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexDotnetCiSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexDotnetCiChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexDotnetCiUpdate(source, update)
		: source;
};
