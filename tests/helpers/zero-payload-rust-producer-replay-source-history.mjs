/**
 * Reverse the exact zero-payload Rust producer replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadRustReplayHistoryPath
	= "docs/evidence/zero-payload-rust-producer-replay-source-history-20261024.json";
export const zeroPayloadRustReplayPredecessor
	= "ebd4d7e73417939efb973688a5fb434651a6f2c9";
export const zeroPayloadRustReplayImplementation
	= "ff0895e642289d7af66de90222b5a58ff0076f26";
export const zeroPayloadRustReplayImplementationAddedPaths
	= Object.freeze([
		"tests/helpers/zero-payload-rust-producer-replay-tests.mjs"
	]);
export const zeroPayloadRustReplayModifiedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-rust-report.mjs"
]);
export const zeroPayloadRustReplayImplementationPaths
	= Object.freeze([
		...zeroPayloadRustReplayModifiedPaths
		, ...zeroPayloadRustReplayImplementationAddedPaths
	]);
export const zeroPayloadRustReplayIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/checked-javascript.test.mjs"
	]);
export const zeroPayloadRustReplayNormalizationPaths
	= Object.freeze([
		...zeroPayloadRustReplayModifiedPaths
		, ...zeroPayloadRustReplayIntegrationPaths
	]);
export const zeroPayloadRustReplayAddedPaths = Object.freeze([
	...zeroPayloadRustReplayImplementationAddedPaths
	, "scripts/update-zero-payload-rust-producer-replay-source-history.mjs"
	, "tests/helpers/zero-payload-rust-producer-replay-source-history-tests.mjs"
	, "tests/helpers/zero-payload-rust-producer-replay-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadRustReplayHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadRustReplayUpdate = (
	source, update
) => {
	assert.ok(zeroPayloadRustReplayNormalizationPaths
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
 * Remove only the exact zero-payload Rust producer replay.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadRustReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !zeroPayloadRustReplayNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseZeroPayloadRustReplayUpdate(source, update)
		: source;
};
