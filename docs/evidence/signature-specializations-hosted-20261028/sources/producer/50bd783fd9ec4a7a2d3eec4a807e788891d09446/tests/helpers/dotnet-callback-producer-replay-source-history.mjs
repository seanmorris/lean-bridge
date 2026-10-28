/**
 * Authenticate the source-bound .NET callback replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dotnetCallbackProducerReplayHistoryPath
	= "docs/evidence/dotnet-callback-producer-replay-source-history-20261024.json";
export const dotnetCallbackProducerReplayPredecessor
	= "849d80856bcd5f7459ed349c6ce1fdfc7050b687";
export const dotnetCallbackProducerReplayImplementation
	= "4f1d97f20f76ef5224faa707ba15f4cd182a36bb";
export const dotnetCallbackProducerReplayIntegrationBase
	= "4f1d97f20f76ef5224faa707ba15f4cd182a36bb";
export const dotnetCallbackProducerReplayCommits = Object.freeze([
	"4f1d97f20f76ef5224faa707ba15f4cd182a36bb"
]);
export const dotnetCallbackProducerReplayChangedPaths = Object.freeze([
	"tests/helpers/owned-dotnet-callback-result-acceptance-tests.mjs"
	, "tests/helpers/owned-dotnet-callback-result-acceptance.mjs"
	, "tests/helpers/owned-dotnet-callback-result-combined-evidence.mjs"
	, "tests/helpers/owned-dotnet-callback-result-evidence.mjs"
	, "tests/helpers/owned-dotnet-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-dotnet-callback-result-package-execution.mjs"
	, "tests/helpers/owned-python-callback-result-acceptance.mjs"
	, "tests/helpers/owned-ruby-callback-result-acceptance.mjs"
	, "tests/helpers/owned-ruby-callback-result-package-evidence.mjs"
]);
export const dotnetCallbackProducerReplayImplementationAddedPaths = Object.freeze([
	"tests/helpers/owned-dotnet-callback-result-replay-tests.mjs"
	, "tests/helpers/owned-dotnet-callback-result-replay.mjs"
]);
export const dotnetCallbackProducerReplayImplementationPaths = Object.freeze([
	...dotnetCallbackProducerReplayChangedPaths
	, ...dotnetCallbackProducerReplayImplementationAddedPaths
]);
export const dotnetCallbackProducerReplayIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const dotnetCallbackProducerReplayNormalizationPaths = Object.freeze([
	...dotnetCallbackProducerReplayChangedPaths
	, ...dotnetCallbackProducerReplayIntegrationPaths
]);
export const dotnetCallbackProducerReplayHistoryAddedPaths = Object.freeze([
	"scripts/update-dotnet-callback-producer-replay-source-history.mjs"
	, "tests/helpers/dotnet-callback-producer-replay-source-history-tests.mjs"
	, "tests/helpers/dotnet-callback-producer-replay-source-history.mjs"
]);
export const dotnetCallbackProducerReplayAddedPaths = Object.freeze([
	...dotnetCallbackProducerReplayImplementationAddedPaths
	, ...dotnetCallbackProducerReplayHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dotnetCallbackProducerReplayHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseDotnetCallbackProducerReplayUpdate = (
	source, update
) => {
	assert.ok(dotnetCallbackProducerReplayNormalizationPaths
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
 * Remove only the exact .NET callback replay.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeDotnetCallbackProducerReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dotnetCallbackProducerReplayNormalizationPaths.includes(path))
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
		current = reverseDotnetCallbackProducerReplayUpdate(current, update);
	}
	return current;
};
