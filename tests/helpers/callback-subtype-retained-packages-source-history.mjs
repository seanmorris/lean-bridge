/**
 * Reverse the callback Subtype retained package transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeRetainedPackagesHistoryPath
	= "docs/evidence/callback-subtype-retained-packages-source-history-20261022.json";
export const callbackSubtypeRetainedPackagesPredecessor
	= "387542894c5f8b9767b6ac2151da4d14680160fb";
export const callbackSubtypeRetainedPackagesImplementation
	= "d98d58e5a8bf564fa4e3cc1a90b66d63fca3683e";
export const callbackSubtypeRetainedPackagesHistoryParent
	= "f759f3c11294cad29a8d61224054430c6862c93f";
export const callbackSubtypeRetainedPackagesHistoricalAdditions = Object.freeze([
	"tests/helpers/callback-subtype-retained-packages.mjs"
]);
export const callbackSubtypeRetainedPackagesModifiedPaths = Object.freeze([
	"scripts/archive-callback-subtype-evidence.mjs"
	, "scripts/check-callback-subtype-languages-ci.mjs"
	, "scripts/check-callback-subtype-native-ci.mjs"
	, "scripts/check-callback-subtype-perl-ci.mjs"
	, "scripts/check-callback-subtype-remaining-ci.mjs"
	, "tests/callback-subtype-language-installed.test.mjs"
	, "tests/callback-subtype-native-ci.test.mjs"
	, "tests/callback-subtype-native-installed.test.mjs"
	, "tests/callback-subtype-perl-installed.test.mjs"
	, "tests/callback-subtype-remaining-installed.test.mjs"
	, "tests/helpers/callback-subtype-hosted-evidence.mjs"
]);
export const callbackSubtypeRetainedPackagesImplementationPaths
	= Object.freeze([
		...callbackSubtypeRetainedPackagesModifiedPaths
		, ...callbackSubtypeRetainedPackagesHistoricalAdditions
	]);
export const callbackSubtypeRetainedPackagesIntegrationPaths
	= Object.freeze([
		"tests/callback-subtype-native-ci.test.mjs"
		, "tests/helpers/callback-subtype-retained-packages.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const callbackSubtypeRetainedPackagesChangedPaths
	= Object.freeze([...new Set([
		...callbackSubtypeRetainedPackagesModifiedPaths
		, ...callbackSubtypeRetainedPackagesIntegrationPaths
	])]);
export const callbackSubtypeRetainedPackagesAddedPaths = Object.freeze([
	"scripts/update-callback-subtype-retained-packages-source-history.mjs"
	, "tests/helpers/callback-subtype-retained-packages-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-retained-packages-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeRetainedPackagesHistoryPath, "utf8"));

/**
 * Restore one exact transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeRetainedPackagesUpdate
	= (source, update) => {
		assert.ok(callbackSubtypeRetainedPackagesChangedPaths
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
 * Remove only the exact callback Subtype retained package change.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeRetainedPackagesSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeRetainedPackagesChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const integration = data.integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseCallbackSubtypeRetainedPackagesUpdate(source, integration);
		if(sha256(source) === expected) return source;
	}
	const historical = data.historicalUpdates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return historical
		? reverseCallbackSubtypeRetainedPackagesUpdate(source, historical)
		: source;
};
