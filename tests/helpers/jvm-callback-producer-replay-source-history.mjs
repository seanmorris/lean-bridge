/**
 * Authenticate the source-bound JVM callback replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const jvmCallbackProducerReplayHistoryPath
	= "docs/evidence/jvm-callback-producer-replay-source-history-20261024.json";
export const jvmCallbackProducerReplayPredecessor
	= "f6a82002bf13398b28801dc917bc9e3d776d5510";
export const jvmCallbackProducerReplayImplementation
	= "e50ca827dc91e6dabc5f80602bd9622edaa37b00";
export const jvmCallbackProducerReplayIntegrationBase
	= "e50ca827dc91e6dabc5f80602bd9622edaa37b00";
export const jvmCallbackProducerReplayCommits = Object.freeze([
	"e50ca827dc91e6dabc5f80602bd9622edaa37b00"
]);
export const jvmCallbackProducerReplayChangedPaths = Object.freeze([
	"tests/helpers/owned-jvm-callback-result-acceptance-tests.mjs"
	, "tests/helpers/owned-jvm-callback-result-acceptance.mjs"
	, "tests/helpers/owned-jvm-callback-result-combined-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-lifetime-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-runtime-evidence.mjs"
]);
export const jvmCallbackProducerReplayImplementationAddedPaths = Object.freeze([
	"tests/helpers/owned-jvm-callback-result-replay-tests.mjs"
	, "tests/helpers/owned-jvm-callback-result-replay.mjs"
]);
export const jvmCallbackProducerReplayImplementationPaths = Object.freeze([
	...jvmCallbackProducerReplayChangedPaths
	, ...jvmCallbackProducerReplayImplementationAddedPaths
]);
export const jvmCallbackProducerReplayIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const jvmCallbackProducerReplayNormalizationPaths = Object.freeze([
	...jvmCallbackProducerReplayChangedPaths
	, ...jvmCallbackProducerReplayIntegrationPaths
]);
export const jvmCallbackProducerReplayHistoryAddedPaths = Object.freeze([
	"scripts/update-jvm-callback-producer-replay-source-history.mjs"
	, "tests/helpers/jvm-callback-producer-replay-source-history-tests.mjs"
	, "tests/helpers/jvm-callback-producer-replay-source-history.mjs"
]);
export const jvmCallbackProducerReplayAddedPaths = Object.freeze([
	...jvmCallbackProducerReplayImplementationAddedPaths
	, ...jvmCallbackProducerReplayHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	jvmCallbackProducerReplayHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseJvmCallbackProducerReplayUpdate = (
	source, update
) => {
	assert.ok(jvmCallbackProducerReplayNormalizationPaths
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
 * Remove only the exact JVM callback replay.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeJvmCallbackProducerReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !jvmCallbackProducerReplayNormalizationPaths.includes(path))
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
		current = reverseJvmCallbackProducerReplayUpdate(current, update);
	}
	return current;
};
