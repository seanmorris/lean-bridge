/**
 * Authenticate inherited checked-record .NET artifact-retention support as one exact, reversible
 * source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordDotnetArtifactRetentionHistoryPath
	= "docs/evidence/inherited-checked-record-dotnet-artifact-retention-source-history-20261017.json";
export const inheritedCheckedRecordDotnetArtifactRetentionPredecessor
	= "3ead6e87aadde50772e29d21549d31ba15bf13da";
export const inheritedCheckedRecordDotnetArtifactRetentionDraftParent
	= "f57b68eae0866fed44b435907afc445be0aa8c76";
export const inheritedCheckedRecordDotnetArtifactRetentionChangedPaths = Object.freeze([
	".github/workflows/inherited-checked-record-dotnet.yml"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-ci-workflow-tests.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-ci-workflow.mjs"
]);
export const inheritedCheckedRecordDotnetArtifactRetentionAddedPaths = Object.freeze([
	"scripts/update-inherited-checked-record-dotnet-artifact-retention-source-history.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-artifact-retention-source-history.mjs"
	, "tests/inherited-checked-record-dotnet-artifact-retention-source-history.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordDotnetArtifactRetentionHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record .NET artifact-retention transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordDotnetArtifactRetentionUpdate = (source, update) => {
	assert.ok(inheritedCheckedRecordDotnetArtifactRetentionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
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
 * Remove only this .NET artifact-retention layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordDotnetArtifactRetentionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordDotnetArtifactRetentionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordDotnetArtifactRetentionUpdate(source, update)
		: source;
};

