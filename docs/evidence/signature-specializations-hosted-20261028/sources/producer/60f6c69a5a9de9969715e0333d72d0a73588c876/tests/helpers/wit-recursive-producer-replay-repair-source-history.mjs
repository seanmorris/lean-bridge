/**
 * Reverse the exact WIT recursive producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const witRecursiveProducerReplayRepairHistoryPath
	= "docs/evidence/wit-recursive-producer-replay-repair-source-history-20261023.json";
export const witRecursiveProducerReplayRepairPredecessor
	= "7f0583c5d17f806d22ae5d758509cf2757ddf2a3";
export const witRecursiveProducerReplayRepairImplementation
	= "55e300ac3cf1c93c3d160bbea64653719174f36e";
export const witRecursiveProducerReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/producer-module.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/helpers/wit-recursive-callable-probes.mjs"
	, "tests/helpers/wit-recursive-callable-receipt.mjs"
	, "tests/helpers/wit-recursive-callable-source-history.mjs"
	, "tests/wit-recursive-callable-evidence.test.mjs"
]);
export const witRecursiveProducerReplayRepairImplementationPaths
	= Object.freeze([
		...witRecursiveProducerReplayRepairModifiedPaths
		, "tests/helpers/wit-recursive-callable-producer.mjs"
	]);
export const witRecursiveProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/wit-recursive-callable-faults.test.mjs"
	]);
export const witRecursiveProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...witRecursiveProducerReplayRepairModifiedPaths
		, ...witRecursiveProducerReplayRepairIntegrationPaths
	]);
export const witRecursiveProducerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-wit-recursive-producer-replay-repair-source-history.mjs"
	, "tests/helpers/wit-recursive-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/wit-recursive-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	witRecursiveProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseWitRecursiveProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(witRecursiveProducerReplayRepairNormalizationPaths
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
 * Remove only the exact WIT recursive producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeWitRecursiveProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !witRecursiveProducerReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseWitRecursiveProducerReplayRepairUpdate(source, update)
		: source;
};
