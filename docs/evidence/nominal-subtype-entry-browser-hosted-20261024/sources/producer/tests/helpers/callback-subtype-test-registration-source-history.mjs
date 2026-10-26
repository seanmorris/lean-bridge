/**
 * Reverse the callback Subtype test-registration transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeTestRegistrationHistoryPath
	= "docs/evidence/callback-subtype-test-registration-source-history-20261022.json";
export const callbackSubtypeTestRegistrationPredecessor
	= "a3dc121a1bdc0f05474b44ab47e53f4d7eafe55e";
export const callbackSubtypeTestRegistrationImplementation
	= "47859a559694f28bf8256992f770b04862c87627";
export const callbackSubtypeTestRegistrationImplementationPaths
	= Object.freeze([
		"src/adoption/test-profiles.mjs"
		, "tests/callback-subtype-hosted-archive.test.mjs"
		, "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
	]);
export const callbackSubtypeTestRegistrationModifiedPaths
	= callbackSubtypeTestRegistrationImplementationPaths;
export const callbackSubtypeTestRegistrationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const callbackSubtypeTestRegistrationChangedPaths = Object.freeze([
	...callbackSubtypeTestRegistrationModifiedPaths
	, ...callbackSubtypeTestRegistrationIntegrationPaths
]);
export const callbackSubtypeTestRegistrationAddedPaths = Object.freeze([
	"scripts/update-callback-subtype-test-registration-source-history.mjs"
	, "tests/helpers/callback-subtype-test-registration-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-test-registration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeTestRegistrationHistoryPath, "utf8"));

/**
 * Restore one exact transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeTestRegistrationUpdate
	= (source, update) => {
		assert.ok(callbackSubtypeTestRegistrationChangedPaths
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
 * Remove only the exact callback Subtype test-registration transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeTestRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeTestRegistrationChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackSubtypeTestRegistrationUpdate(source, update)
		: source;
};
