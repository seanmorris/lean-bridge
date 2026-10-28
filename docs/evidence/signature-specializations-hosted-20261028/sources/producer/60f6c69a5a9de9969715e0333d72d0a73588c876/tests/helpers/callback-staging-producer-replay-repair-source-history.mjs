/**
 * Reverse the exact callback-staging producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackStagingProducerReplayRepairHistoryPath
	= "docs/evidence/callback-staging-producer-replay-repair-source-history-20261023.json";
export const callbackStagingProducerReplayRepairPredecessor
	= "f258d858f0058b15562ba8f1ba3c5e9cff1d01ad";
export const callbackStagingProducerReplayRepairImplementation
	= "70853e3cffc5c68f3b151b001021a2042ee4663b";
export const callbackStagingProducerReplayRepairChangedPaths = Object.freeze([
	"tests/helpers/owned-perl-callback-result-history-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-history.mjs"
	, "tests/helpers/producer-source.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history-tests.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history.mjs"
]);
export const callbackStagingProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-jvm-callback-result-history.test.mjs"
	]);
export const callbackStagingProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...callbackStagingProducerReplayRepairChangedPaths
		, ...callbackStagingProducerReplayRepairIntegrationPaths
	]);
export const callbackStagingProducerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-callback-staging-producer-replay-repair-source-history.mjs"
	, "tests/helpers/callback-staging-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/callback-staging-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackStagingProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackStagingProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(callbackStagingProducerReplayRepairNormalizationPaths
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
 * Remove only the exact callback-staging producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackStagingProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackStagingProducerReplayRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackStagingProducerReplayRepairUpdate(source, update)
		: source;
};
