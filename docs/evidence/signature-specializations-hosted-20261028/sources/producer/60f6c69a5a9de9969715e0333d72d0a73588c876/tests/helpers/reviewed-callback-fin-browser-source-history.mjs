/**
 * Authenticate the reviewed callback-Fin browser corpus without rewriting the
 * earlier Node, native or ordinary-browser evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const reviewedCallbackFinBrowserHistoryPath
	= "docs/evidence/reviewed-callback-fin-browser-source-history-20261028.json";
export const reviewedCallbackFinBrowserPredecessor
	= "638f961832fa024f1a4ff8ba93f960ec3bdd5d8d";
export const reviewedCallbackFinBrowserImplementation
	= "85aea33d363d8e0bbaea52e35aa3ebb7d36d6063";
export const reviewedCallbackFinBrowserChangedPaths = Object.freeze([
	".github/workflows/callback-checked-record-browser.yml"
	, "tests/callback-checked-record-browser-ci.test.mjs"
	, "tests/helpers/reviewed-callback-fin-consumer.mjs"
	, "tests/reviewed-callback-fin.test.mjs"
]);
export const reviewedCallbackFinBrowserIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-callback-harness-source-history-tests.mjs"
	, "tests/reviewed-callback-fin.test.mjs"
]);
export const reviewedCallbackFinBrowserNormalizationPaths = Object.freeze([
	...new Set([
		...reviewedCallbackFinBrowserChangedPaths
		, ...reviewedCallbackFinBrowserIntegrationPaths
	])
].toSorted());
export const reviewedCallbackFinBrowserImplementationAddedPaths = Object.freeze([
	"scripts/check-reviewed-callback-fin-browser-ci.mjs"
	, "scripts/run-reviewed-callback-fin-browser-ci.sh"
	, "tests/helpers/reviewed-callback-fin-browser-ci.mjs"
	, "tests/reviewed-callback-fin-browser-ci.test.mjs"
]);
export const reviewedCallbackFinBrowserHistoryAddedPaths = Object.freeze([
	"scripts/update-reviewed-callback-fin-browser-source-history.mjs"
	, "tests/helpers/reviewed-callback-fin-browser-source-history-tests.mjs"
	, "tests/helpers/reviewed-callback-fin-browser-source-history.mjs"
]);
export const reviewedCallbackFinBrowserAddedPaths = Object.freeze([
	...reviewedCallbackFinBrowserImplementationAddedPaths
	, ...reviewedCallbackFinBrowserHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	reviewedCallbackFinBrowserHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedCallbackFinBrowserUpdate = (source, update) => {
	assert.ok(reviewedCallbackFinBrowserNormalizationPaths.includes(update.path));
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
 * Remove only the exact reviewed callback-Fin browser transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeReviewedCallbackFinBrowserSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !reviewedCallbackFinBrowserNormalizationPaths.includes(path))
		return source;
	const value = record(), updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseReviewedCallbackFinBrowserUpdate(current, update);
	}
	return current;
};
