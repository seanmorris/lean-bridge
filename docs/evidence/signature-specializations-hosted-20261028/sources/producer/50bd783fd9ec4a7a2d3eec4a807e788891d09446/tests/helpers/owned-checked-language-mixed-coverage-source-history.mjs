/**
 * Authenticate expanded Python, Ruby and Rust source coverage without inferring installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedLanguageMixedCoverageHistoryPath
	= "docs/evidence/owned-checked-language-mixed-coverage-source-history-20261025.json";
export const ownedCheckedLanguageMixedCoveragePredecessor
	= "a005b6f0f8ac3f978cb2d749832de14b3b7d070e";
export const ownedCheckedLanguageMixedCoverageImplementation
	= "771f1f3da36c7e861a5bdc446e0abcbc6f121bc3";
export const ownedCheckedLanguageMixedCoverageIntegrationBase
	= "771f1f3da36c7e861a5bdc446e0abcbc6f121bc3";
export const ownedCheckedLanguageMixedCoverageCommits = Object.freeze([
	"771f1f3da36c7e861a5bdc446e0abcbc6f121bc3"
]);
export const ownedCheckedLanguageMixedCoverageChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/fixtures/structured-types/owned-checked-record-python.py"
	, "tests/fixtures/structured-types/owned-checked-record-ruby.rb"
	, "tests/fixtures/structured-types/owned-checked-record-rust.rs"
	, "tests/helpers/owned-checked-record-language-fixture.mjs"
	, "tests/helpers/owned-checked-record-native-fixture.mjs"
	, "tests/helpers/owned-checked-record-promotion-tests.mjs"
	, "tests/owned-checked-record-language-packaging.test.mjs"
]);
export const ownedCheckedLanguageMixedCoverageImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-language-mixed-coverage-20261025.json"
	, "tests/helpers/owned-checked-record-mixed-fixture.mjs"
]);
export const ownedCheckedLanguageMixedCoverageImplementationPaths = Object.freeze([
	...ownedCheckedLanguageMixedCoverageChangedPaths
	, ...ownedCheckedLanguageMixedCoverageImplementationAddedPaths
]);
export const ownedCheckedLanguageMixedCoverageIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/owned-checked-record-language-source-history-tests.mjs"
]);
export const ownedCheckedLanguageMixedCoverageNormalizationPaths = Object.freeze([
	...ownedCheckedLanguageMixedCoverageChangedPaths
	, ...ownedCheckedLanguageMixedCoverageIntegrationPaths
]);
export const ownedCheckedLanguageMixedCoverageHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-language-mixed-coverage-source-history.mjs"
	, "tests/helpers/owned-checked-language-mixed-coverage-source-history-tests.mjs"
	, "tests/helpers/owned-checked-language-mixed-coverage-source-history.mjs"
]);
export const ownedCheckedLanguageMixedCoverageAddedPaths = Object.freeze([
	...ownedCheckedLanguageMixedCoverageImplementationAddedPaths
	, ...ownedCheckedLanguageMixedCoverageHistoryAddedPaths
]);
export const ownedCheckedLanguageMixedCoveragePins = Object.freeze([
	Object.freeze({
		"path": "tests/helpers/owned-checked-record-promotion-tests.mjs"
		, "count": 11
		, "previousSha256": "16e8101a1b6b73ee48f3a45e59bdaa2253b067f5cf6f8f590a80c4f142b39e91"
		, "currentSha256": "b159b87f91c8a44aa2629380063fab1b8ac981c3d3a6e318a3fc50d374693c1c"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedLanguageMixedCoverageHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedLanguageMixedCoverageUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedLanguageMixedCoverageNormalizationPaths
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
 * Remove only the exact Owned checked language mixed coverage.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedLanguageMixedCoverageSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedLanguageMixedCoverageNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCheckedLanguageMixedCoverageUpdate(current, update);
	}
	return current;
};
