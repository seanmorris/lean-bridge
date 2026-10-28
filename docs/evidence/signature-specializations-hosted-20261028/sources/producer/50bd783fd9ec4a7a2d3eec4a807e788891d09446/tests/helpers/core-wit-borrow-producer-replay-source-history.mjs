/**
 * Preserve the exact WIT borrowed-result producer replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreWitBorrowProducerReplayHistoryPath
	= "docs/evidence/core-wit-borrow-producer-replay-source-history-20261026.json";
export const coreWitBorrowProducerReplayPredecessor
	= "6284544f9fcca324b841a13a17e00948dfc9293f";
export const coreWitBorrowProducerReplayImplementation
	= "1250c5b2bb2fa514aba6df5f756145ecfa6228a2";
export const coreWitBorrowProducerReplayImplementationPaths = Object.freeze([
	"tests/wit-owned-borrow-evidence.test.mjs"
]);
export const coreWitBorrowProducerReplayIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreWitBorrowProducerReplayNormalizationPaths = Object.freeze([
	...coreWitBorrowProducerReplayImplementationPaths
	, ...coreWitBorrowProducerReplayIntegrationPaths
]);
export const coreWitBorrowProducerReplayAddedPaths = Object.freeze([
	"scripts/update-core-wit-borrow-producer-replay-source-history.mjs"
	, "tests/helpers/core-wit-borrow-producer-replay-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreWitBorrowProducerReplayHistoryPath, "utf8"
));

/**
 * Reverse one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreWitBorrowProducerReplayUpdate = (source, update) => {
	assert.ok(coreWitBorrowProducerReplayNormalizationPaths.includes(
		update.path
	));
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
 * Remove only the authenticated WIT producer replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreWitBorrowProducerReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreWitBorrowProducerReplayNormalizationPaths.includes(path))
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
		current = reverseCoreWitBorrowProducerReplayUpdate(current, update);
	}
	return current;
};
