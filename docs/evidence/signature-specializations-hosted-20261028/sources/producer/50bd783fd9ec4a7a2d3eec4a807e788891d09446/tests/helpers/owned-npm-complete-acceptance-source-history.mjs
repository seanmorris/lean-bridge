/**
 * Authenticate the independent-build and production React acceptance changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedNpmCompleteAcceptanceHistoryPath
	= "docs/evidence/owned-npm-complete-acceptance-source-history-20261025.json";
export const ownedNpmCompleteAcceptancePredecessor
	= "6ca01c96fe3960a54e6709768caea7464c1adc6a";
export const ownedNpmCompleteAcceptanceImplementation
	= "657f7e9d8bee50a3c83336ad8fbc6dabfb681133";
export const ownedNpmCompleteAcceptanceIntegrationBase
	= "657f7e9d8bee50a3c83336ad8fbc6dabfb681133";
export const ownedNpmCompleteAcceptanceCommits = Object.freeze([
	"657f7e9d8bee50a3c83336ad8fbc6dabfb681133"
]);
export const ownedNpmCompleteAcceptanceChangedPaths = Object.freeze([
	"scripts/check-owned-checked-record-javascript-ci.mjs"
	, "tests/helpers/owned-checked-record-javascript-evidence-tests.mjs"
	, "tests/helpers/owned-checked-record-javascript-evidence.mjs"
	, "tests/helpers/owned-javascript-npm-browser.mjs"
	, "tests/owned-checked-record-javascript-packaging.test.mjs"
]);
export const ownedNpmCompleteAcceptanceImplementationAddedPaths = Object.freeze([]);
export const ownedNpmCompleteAcceptanceImplementationPaths = Object.freeze([
	...ownedNpmCompleteAcceptanceChangedPaths
	, ...ownedNpmCompleteAcceptanceImplementationAddedPaths
]);
export const ownedNpmCompleteAcceptanceIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedNpmCompleteAcceptanceNormalizationPaths = Object.freeze([
	...ownedNpmCompleteAcceptanceChangedPaths
	, ...ownedNpmCompleteAcceptanceIntegrationPaths
]);
export const ownedNpmCompleteAcceptanceHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-npm-complete-acceptance-source-history.mjs"
	, "tests/helpers/owned-npm-complete-acceptance-source-history-tests.mjs"
	, "tests/helpers/owned-npm-complete-acceptance-source-history.mjs"
]);
export const ownedNpmCompleteAcceptanceAddedPaths = Object.freeze([
	...ownedNpmCompleteAcceptanceImplementationAddedPaths
	, ...ownedNpmCompleteAcceptanceHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedNpmCompleteAcceptanceHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedNpmCompleteAcceptanceUpdate = (
	source, update
) => {
	assert.ok(ownedNpmCompleteAcceptanceNormalizationPaths
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
 * Remove only the exact Owned npm complete acceptance.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedNpmCompleteAcceptanceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedNpmCompleteAcceptanceNormalizationPaths.includes(path))
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
		current = reverseOwnedNpmCompleteAcceptanceUpdate(current, update);
	}
	return current;
};
