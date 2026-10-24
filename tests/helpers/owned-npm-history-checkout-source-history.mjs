/**
 * Authenticate the owned npm history checkout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedNpmHistoryCheckoutHistoryPath
	= "docs/evidence/owned-npm-history-checkout-source-history-20261024.json";
export const ownedNpmHistoryCheckoutPredecessor
	= "dad0f1e53737a6bce3e9bad60cd1bc5f22e0218d";
export const ownedNpmHistoryCheckoutImplementation
	= "fb7dd84dd7f9c9ffce9d610a859823221b1c9d7b";
export const ownedNpmHistoryCheckoutIntegrationBase
	= "fb7dd84dd7f9c9ffce9d610a859823221b1c9d7b";
export const ownedNpmHistoryCheckoutCommits = Object.freeze([
	"fb7dd84dd7f9c9ffce9d610a859823221b1c9d7b"
]);
export const ownedNpmHistoryCheckoutChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, ".github/workflows/consumer-matrix.yml"
	, ".github/workflows/owned-checked-record-npm-browser.yml"
	, "docs/contributing/testing.md"
	, "tests/helpers/owned-checked-record-npm-producer-tests.mjs"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
]);
export const ownedNpmHistoryCheckoutImplementationAddedPaths = Object.freeze([]);
export const ownedNpmHistoryCheckoutImplementationPaths = Object.freeze([
	...ownedNpmHistoryCheckoutChangedPaths
	, ...ownedNpmHistoryCheckoutImplementationAddedPaths
]);
export const ownedNpmHistoryCheckoutIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedNpmHistoryCheckoutNormalizationPaths = Object.freeze([
	...ownedNpmHistoryCheckoutChangedPaths
	, ...ownedNpmHistoryCheckoutIntegrationPaths
]);
export const ownedNpmHistoryCheckoutHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-npm-history-checkout-source-history.mjs"
	, "tests/helpers/owned-npm-history-checkout-source-history-tests.mjs"
	, "tests/helpers/owned-npm-history-checkout-source-history.mjs"
]);
export const ownedNpmHistoryCheckoutAddedPaths = Object.freeze([
	...ownedNpmHistoryCheckoutImplementationAddedPaths
	, ...ownedNpmHistoryCheckoutHistoryAddedPaths
]);
export const ownedNpmHistoryCheckoutPins = Object.freeze([
	Object.freeze({
		path: ".github/workflows/consumer-matrix.yml"
		, count: 92
		, previousSha256: "0f6003f09e04290081de9e09c52952b54a18b89253f17a843e14ce75e2734381"
		, currentSha256: "6cb56e3b6b828d02642c2cd402f3f30e9293dcd00c10097421de7dacd132dac7"
	})
	, Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "846994037538135be94a0a81e5fca69f0a7ff30b5e7dc6a0a3e514a8e7afd525"
		, currentSha256: "48077b7f415b4391e798bdede3a0201c0f92101037b65f9825a6ee6e7d4497a4"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedNpmHistoryCheckoutHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedNpmHistoryCheckoutUpdate = (
	source, update
) => {
	assert.ok(ownedNpmHistoryCheckoutNormalizationPaths
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
 * Remove only the exact Owned npm history checkout.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedNpmHistoryCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedNpmHistoryCheckoutNormalizationPaths.includes(path))
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
		current = reverseOwnedNpmHistoryCheckoutUpdate(current, update);
	}
	return current;
};
