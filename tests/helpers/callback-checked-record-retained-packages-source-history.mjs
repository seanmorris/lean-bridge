/**
 * Reverse the callback checked-record retained package transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordRetainedPackagesHistoryPath
	= "docs/evidence/callback-checked-record-retained-packages-source-history-20261022.json";
export const callbackCheckedRecordRetainedPackagesPredecessor
	= "921600792ed5c3dcddf2a0b7f1206aede4ed0acb";
export const callbackCheckedRecordRetainedPackagesImplementation
	= "fc8ed53b543a20a25db19c340769cb59a56086fa";
export const callbackCheckedRecordRetainedPackagesHistoryParent
	= "052d9c080451641c5a564e4059642c2a88d24f67";
export const callbackCheckedRecordRetainedPackagesHistoricalAdditions = Object.freeze([
	"tests/helpers/callback-checked-record-retained-packages.mjs"
]);
export const callbackCheckedRecordRetainedPackagesModifiedPaths = Object.freeze([
	"scripts/archive-callback-checked-record-evidence.mjs"
	, "scripts/check-callback-checked-record-languages-ci.mjs"
	, "scripts/check-callback-checked-record-native-ci.mjs"
	, "scripts/check-callback-checked-record-perl-ci.mjs"
	, "scripts/check-callback-checked-record-remaining-ci.mjs"
	, "tests/callback-checked-record-language-installed.test.mjs"
	, "tests/callback-checked-record-native-ci.test.mjs"
	, "tests/callback-checked-record-native-installed.test.mjs"
	, "tests/callback-checked-record-perl-installed.test.mjs"
	, "tests/callback-checked-record-remaining-installed.test.mjs"
	, "tests/helpers/callback-checked-record-hosted-evidence.mjs"
]);
export const callbackCheckedRecordRetainedPackagesImplementationPaths
	= Object.freeze([
		...callbackCheckedRecordRetainedPackagesModifiedPaths
		, ...callbackCheckedRecordRetainedPackagesHistoricalAdditions
	]);
export const callbackCheckedRecordRetainedPackagesIntegrationPaths
	= Object.freeze([
		"tests/callback-checked-record-native-ci.test.mjs"
		, "tests/helpers/callback-checked-record-retained-packages.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const callbackCheckedRecordRetainedPackagesChangedPaths
	= Object.freeze([...new Set([
		...callbackCheckedRecordRetainedPackagesModifiedPaths
		, ...callbackCheckedRecordRetainedPackagesIntegrationPaths
	])]);
export const callbackCheckedRecordRetainedPackagesAddedPaths = Object.freeze([
	"scripts/update-callback-checked-record-retained-packages-source-history.mjs"
	, "tests/helpers/callback-checked-record-retained-packages-source-history-tests.mjs"
	, "tests/helpers/callback-checked-record-retained-packages-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordRetainedPackagesHistoryPath, "utf8"));

/**
 * Restore one exact transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackCheckedRecordRetainedPackagesUpdate
	= (source, update) => {
		assert.ok(callbackCheckedRecordRetainedPackagesChangedPaths
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
 * Remove only the exact callback checked-record retained package change.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordRetainedPackagesSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordRetainedPackagesChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const integration = data.integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseCallbackCheckedRecordRetainedPackagesUpdate(
			source, integration);
		if(sha256(source) === expected) return source;
	}
	const historical = data.historicalUpdates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return historical
		? reverseCallbackCheckedRecordRetainedPackagesUpdate(source, historical)
		: source;
};
