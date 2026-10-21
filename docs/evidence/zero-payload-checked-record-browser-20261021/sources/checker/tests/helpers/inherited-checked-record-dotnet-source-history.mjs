/**
 * Authenticate inherited checked-record .NET support as one exact,
 * reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordDotnetHistoryPath
	= "docs/evidence/inherited-checked-record-dotnet-source-history-20261017.json";
export const inheritedCheckedRecordDotnetPredecessor
	= "f77cde2fc62475208ee8987e319c74c6ad1b2252";
export const inheritedCheckedRecordDotnetDraftParent
	= "9c90a8f59824c6f117bc84a33d8f3fc82446a3e1";
export const inheritedCheckedRecordDotnetChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/dotnet/copied-conversions.mjs"
	, "src/backends/dotnet/copied-model.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const inheritedCheckedRecordDotnetAddedPaths = Object.freeze([
	".github/workflows/inherited-checked-record-dotnet.yml"
	, "scripts/check-inherited-checked-record-dotnet-ci.mjs"
	, "scripts/run-inherited-checked-record-dotnet-ci.sh"
	, "scripts/update-inherited-checked-record-dotnet-source-history.mjs"
	, "tests/dotnet-span-name-contract.test.mjs"
	, "tests/fixtures/inherited-checked-record-consumers/dotnet.cs"
	, "tests/helpers/inherited-checked-record-dotnet-ci-handoff.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-ci-policy-tests.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-ci-report.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-ci-shell-tests.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-ci-tools.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-ci-workflow-tests.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-controls.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-environment-records.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-fixture-tests.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-fixture.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-generators.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-installed-tests.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-model-records.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-package-records.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-package-tests.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-package.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-probe-records.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-probe-tests.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-probe.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-report.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-restore-records.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-runtime-records.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-source-history.mjs"
	, "tests/inherited-checked-record-dotnet-source-history.test.mjs"
	, "tests/inherited-checked-record-dotnet.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordDotnetHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record .NET transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordDotnetUpdate = (
	source, update
) => {
	assert.ok(inheritedCheckedRecordDotnetChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.replacements !== undefined)
	{
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		for(const replacement of [...update.replacements].reverse())
		{
			assert.equal(typeof replacement.previous, "string");
			assert.equal(typeof replacement.current, "string");
			assert.notEqual(replacement.previous, replacement.current);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.current).length - 1
				, replacement.count, update.path);
			source = source.replaceAll(
				replacement.current, replacement.previous);
		}
		assert.equal(sha256(source), update.previousSha256, update.path);
		return source;
	}
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
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
 * Remove only this .NET layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordDotnetSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordDotnetChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordDotnetUpdate(source, update)
		: source;
};
