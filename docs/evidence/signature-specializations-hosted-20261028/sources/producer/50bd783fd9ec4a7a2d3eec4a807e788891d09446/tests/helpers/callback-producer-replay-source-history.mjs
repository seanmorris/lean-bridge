/**
 * Reverse the exact callback producer replay history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackProducerReplayHistoryPath
	= "docs/evidence/callback-producer-replay-source-history-20261024.json";
export const callbackProducerReplayPredecessor
	= "e3e15ee9ca01c6462c2538177357327c7fa1dc23";
export const callbackProducerReplayImplementation
	= "a3c856c6cb29c1de5b6bb65c681b80939f032ab9";
export const callbackProducerReplayImplementationAddedPaths
	= Object.freeze([
		"tests/helpers/owned-callback-inventory-endpoint-tests.mjs"
		, "tests/helpers/owned-callback-result-producer-tests.mjs"
		, "tests/helpers/owned-callback-result-producer.mjs"
	]);
export const callbackProducerReplayModifiedPaths = Object.freeze([
	"tests/helpers/owned-callback-inventory-history.mjs"
	, "tests/helpers/owned-callback-result-evidence.mjs"
	, "tests/owned-callback-inventory-repair.test.mjs"
]);
export const callbackProducerReplayImplementationPaths
	= Object.freeze([
		...callbackProducerReplayModifiedPaths
		, ...callbackProducerReplayImplementationAddedPaths
	]);
export const callbackProducerReplayIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/checked-javascript.test.mjs"
	]);
export const callbackProducerReplayNormalizationPaths
	= Object.freeze([
		...callbackProducerReplayModifiedPaths
		, ...callbackProducerReplayIntegrationPaths
	]);
export const callbackProducerReplayAddedPaths = Object.freeze([
	...callbackProducerReplayImplementationAddedPaths
	, "scripts/update-callback-producer-replay-source-history.mjs"
	, "tests/helpers/callback-producer-replay-source-history-tests.mjs"
	, "tests/helpers/callback-producer-replay-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackProducerReplayHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackProducerReplayUpdate = (
	source, update
) => {
	assert.ok(callbackProducerReplayNormalizationPaths
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
 * Remove only the exact callback producer replay history.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackProducerReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackProducerReplayNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackProducerReplayUpdate(source, update)
		: source;
};
