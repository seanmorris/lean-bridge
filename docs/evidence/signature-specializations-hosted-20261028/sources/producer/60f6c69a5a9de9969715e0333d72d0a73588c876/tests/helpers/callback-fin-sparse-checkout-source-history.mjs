/**
 * Preserve the sparse native callback-Fin producer checkout and its exact
 * live source-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinSparseCheckoutHistoryPath
	= "docs/evidence/callback-fin-sparse-checkout-source-history-20261028.json";
export const callbackFinSparseCheckoutPredecessor
	= "174c6f114e563f12f2f346c73b007d6ec5022dd1";
export const callbackFinSparseCheckoutImplementation
	= "be95f599fe2b11c59bc03b4baa48a31eeacf1616";
export const callbackFinSparseCheckoutPinRepair
	= "bc0e1de9cc1460a61cb78ddc8c496cf3dd163ae6";
export const callbackFinSparseCheckoutImplementationPaths = Object.freeze([
	".github/workflows/callback-checked-record-languages.yml"
	, ".github/workflows/callback-checked-record-perl.yml"
]);
export const callbackFinSparseCheckoutPinPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const callbackFinSparseCheckoutIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackFinSparseCheckoutAddedPaths = Object.freeze([
	"scripts/update-callback-fin-sparse-checkout-source-history.mjs"
	, "tests/helpers/callback-fin-sparse-checkout-source-history-tests.mjs"
	, "tests/helpers/callback-fin-sparse-checkout-source-history.mjs"
]);
export const callbackFinSparseCheckoutNormalizationPaths = Object.freeze([
	...callbackFinSparseCheckoutImplementationPaths
	, ...callbackFinSparseCheckoutPinPaths
	, ...callbackFinSparseCheckoutIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinSparseCheckoutHistoryPath, "utf8"
));

/**
 * Reverse one exact sparse-checkout or integration transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCallbackFinSparseCheckoutUpdate = (source, update) => {
	assert.ok(callbackFinSparseCheckoutNormalizationPaths.includes(update.path));
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated sparse callback-Fin checkout transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCallbackFinSparseCheckoutSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackFinSparseCheckoutNormalizationPaths.includes(path)) return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.pinUpdates
		, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCallbackFinSparseCheckoutUpdate(current, update);
	}
	return current;
};
