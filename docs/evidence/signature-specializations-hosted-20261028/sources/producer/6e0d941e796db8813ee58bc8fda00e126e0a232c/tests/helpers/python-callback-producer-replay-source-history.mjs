/**
 * Authenticate the source-bound Python callback replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const pythonCallbackProducerReplayHistoryPath
	= "docs/evidence/python-callback-producer-replay-source-history-20261024.json";
export const pythonCallbackProducerReplayPredecessor
	= "3548c0fa6108c5f8d3c5dff62dceff7fa377d3af";
export const pythonCallbackProducerReplayImplementation
	= "8b31a971448971541f04b8a60f9fbf3602ac9447";
export const pythonCallbackProducerReplayIntegrationBase
	= "8b31a971448971541f04b8a60f9fbf3602ac9447";
export const pythonCallbackProducerReplayCommits = Object.freeze([
	"8b31a971448971541f04b8a60f9fbf3602ac9447"
]);
export const pythonCallbackProducerReplayChangedPaths = Object.freeze([
	"tests/helpers/owned-python-callback-result-acceptance.mjs"
	, "tests/helpers/owned-python-callback-result-evidence.mjs"
	, "tests/owned-python-callback-result-evidence.test.mjs"
]);
export const pythonCallbackProducerReplayImplementationAddedPaths = Object.freeze([
	"tests/helpers/owned-python-callback-result-replay-tests.mjs"
	, "tests/helpers/owned-python-callback-result-replay.mjs"
]);
export const pythonCallbackProducerReplayImplementationPaths = Object.freeze([
	...pythonCallbackProducerReplayChangedPaths
	, ...pythonCallbackProducerReplayImplementationAddedPaths
]);
export const pythonCallbackProducerReplayIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const pythonCallbackProducerReplayNormalizationPaths = Object.freeze([
	...pythonCallbackProducerReplayChangedPaths
	, ...pythonCallbackProducerReplayIntegrationPaths
]);
export const pythonCallbackProducerReplayHistoryAddedPaths = Object.freeze([
	"scripts/update-python-callback-producer-replay-source-history.mjs"
	, "tests/helpers/python-callback-producer-replay-source-history-tests.mjs"
	, "tests/helpers/python-callback-producer-replay-source-history.mjs"
]);
export const pythonCallbackProducerReplayAddedPaths = Object.freeze([
	...pythonCallbackProducerReplayImplementationAddedPaths
	, ...pythonCallbackProducerReplayHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	pythonCallbackProducerReplayHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePythonCallbackProducerReplayUpdate = (
	source, update
) => {
	assert.ok(pythonCallbackProducerReplayNormalizationPaths
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
 * Remove only the exact Python callback replay.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePythonCallbackProducerReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !pythonCallbackProducerReplayNormalizationPaths.includes(path))
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
		current = reversePythonCallbackProducerReplayUpdate(current, update);
	}
	return current;
};
