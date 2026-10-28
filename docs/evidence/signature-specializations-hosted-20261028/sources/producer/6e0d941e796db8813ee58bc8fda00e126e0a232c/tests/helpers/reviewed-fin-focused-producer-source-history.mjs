/**
 * Preserve the focused reviewed-Fin producer and structural prelude repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const reviewedFinFocusedProducerHistoryPath
	= "docs/evidence/reviewed-fin-focused-producer-source-history-20261028.json";
export const reviewedFinFocusedProducerPredecessor
	= "8975d3aa4aa978b207c87d6f5dbcad7258f9cad2";
export const reviewedFinFocusedProducerImplementation
	= "ac015a8ef9d15b7cdb5a41ee2b2d80ba64d46153";
export const reviewedFinFocusedProducerTrigger
	= "f12e40df7226d716573c4e86ba6f1e90ff3b797d";
export const reviewedFinFocusedProducerImplementationPaths = Object.freeze([
	"scripts/archive-reviewed-fin-wasm-entry-hosted.mjs"
	, "tests/helpers/reviewed-fin-wasm-contract-tests.mjs"
	, "tests/helpers/reviewed-fin-wasm-entry-hosted-archive.mjs"
	, "tests/helpers/reviewed-fin-wasm-entry-producer.mjs"
	, "tests/reviewed-fin-wasm-entry-hosted-archive.test.mjs"
	, "tests/workflow-trigger-policy.test.mjs"
]);
export const reviewedFinFocusedProducerImplementationAddedPaths = Object.freeze([
	".github/workflows/reviewed-fin-wasm-entry.yml"
	, "tests/reviewed-fin-wasm-entry-workflow.test.mjs"
]);
export const reviewedFinFocusedProducerTriggerPaths = Object.freeze([
	".github/workflows/reviewed-fin-wasm-entry.yml"
]);
export const reviewedFinFocusedProducerIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const reviewedFinFocusedProducerIntegrationAddedPaths = Object.freeze([
	"scripts/update-reviewed-fin-focused-producer-source-history.mjs"
	, "tests/helpers/reviewed-fin-focused-producer-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-focused-producer-source-history.mjs"
]);
export const reviewedFinFocusedProducerAddedPaths = Object.freeze([
	...reviewedFinFocusedProducerImplementationAddedPaths
	, ...reviewedFinFocusedProducerIntegrationAddedPaths
]);
export const reviewedFinFocusedProducerNormalizationPaths = Object.freeze([
	...reviewedFinFocusedProducerImplementationPaths
	, ...reviewedFinFocusedProducerTriggerPaths
	, ...reviewedFinFocusedProducerIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	reviewedFinFocusedProducerHistoryPath, "utf8"
));

/**
 * Reverse one exact focused-producer source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseReviewedFinFocusedProducerUpdate = (source, update) => {
	assert.ok(reviewedFinFocusedProducerNormalizationPaths
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
 * Remove only the authenticated focused-producer transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeReviewedFinFocusedProducerSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !reviewedFinFocusedProducerNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [
		...value.integrationUpdates, ...value.triggerUpdates, ...value.updates
	];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseReviewedFinFocusedProducerUpdate(current, update);
	}
	return current;
};
