/**
 * Preserve the exact final Fin field/callback promotion and its registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finCompletionPromotionHistoryPath
	= "docs/evidence/fin-completion-promotion-source-history-20261028.json";
export const finCompletionPromotionPredecessor
	= "c5446a6df648e9d4d1cfcd230322c40977a3362b";
export const finCompletionPromotionImplementation
	= "69039535fadd04dad391c015ea0a8db443faa0b4";
export const finCompletionPromotionImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const finCompletionPromotionIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const finCompletionPromotionIntegrationAddedPaths = Object.freeze([
	"scripts/update-fin-completion-promotion-source-history.mjs"
	, "tests/helpers/fin-completion-promotion-source-history-tests.mjs"
	, "tests/helpers/fin-completion-promotion-source-history.mjs"
]);
export const finCompletionPromotionNormalizationPaths = Object.freeze([
	...finCompletionPromotionImplementationPaths
	, ...finCompletionPromotionIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	finCompletionPromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact final-Fin promotion source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseFinCompletionPromotionUpdate = (source, update) => {
	assert.ok(finCompletionPromotionNormalizationPaths.includes(update.path));
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
 * Remove only the authenticated final-Fin promotion transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeFinCompletionPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !finCompletionPromotionNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseFinCompletionPromotionUpdate(current, update);
	}
	return current;
};
