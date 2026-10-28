/**
 * Preserve the exact receiver-CI producer replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreReceiverCiProducerReplayHistoryPath
	= "docs/evidence/core-receiver-ci-producer-replay-source-history-20261026.json";
export const coreReceiverCiProducerReplayPredecessor
	= "c5d8c39dab4d303c1ed57d8a9a46bf4c5fc81125";
export const coreReceiverCiProducerReplayImplementation
	= "1a11a1c4ebdc91fc914f2519abde5d251e64bc26";
export const coreReceiverCiProducerReplayImplementationPaths
	= Object.freeze([
		"tests/owned-perl-receiver-ci.test.mjs"
	]);
export const coreReceiverCiProducerReplayIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreReceiverCiProducerReplayNormalizationPaths = Object.freeze([
	...coreReceiverCiProducerReplayImplementationPaths
	, ...coreReceiverCiProducerReplayIntegrationPaths
]);
export const coreReceiverCiProducerReplayAddedPaths = Object.freeze([
	"scripts/update-core-receiver-ci-producer-replay-source-history.mjs"
	, "tests/helpers/core-receiver-ci-producer-replay-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreReceiverCiProducerReplayHistoryPath, "utf8"
));

/**
 * Reverse one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreReceiverCiProducerReplayUpdate = (source, update) => {
	assert.ok(coreReceiverCiProducerReplayNormalizationPaths.includes(
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
 * Remove only the authenticated receiver-CI producer replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreReceiverCiProducerReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreReceiverCiProducerReplayNormalizationPaths.includes(path))
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
		current = reverseCoreReceiverCiProducerReplayUpdate(current, update);
	}
	return current;
};
