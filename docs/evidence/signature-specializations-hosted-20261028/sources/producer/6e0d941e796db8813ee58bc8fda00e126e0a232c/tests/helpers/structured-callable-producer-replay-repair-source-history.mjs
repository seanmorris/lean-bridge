/**
 * Reverse the exact structured-callable producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const structuredCallableProducerReplayRepairHistoryPath
	= "docs/evidence/structured-callable-producer-replay-repair-source-history-20261023.json";
export const structuredCallableProducerReplayRepairPredecessor
	= "206e6ba278e1a29b7cab46d274f84537e03b5ba5";
export const structuredCallableProducerReplayRepairImplementation
	= "e0de47106ea3e3362c4dd4501934c1b97560f0d5";
export const structuredCallableProducerReplayRepairImplementationAddedPaths
	= Object.freeze([
		"tests/helpers/producer-source.mjs"
	]);
export const structuredCallableProducerReplayRepairModifiedPaths
	= Object.freeze([
		"tests/helpers/c-structured-callable-evidence.mjs"
		, "tests/helpers/cpp-structured-callable-evidence.mjs"
		, "tests/helpers/dotnet-structured-callable-evidence.mjs"
		, "tests/helpers/jvm-structured-callable-evidence.mjs"
		, "tests/helpers/jvm-structured-callable-regression.mjs"
		, "tests/helpers/python-structured-callable-evidence.mjs"
		, "tests/helpers/ruby-structured-callable-evidence.mjs"
		, "tests/helpers/rust-structured-callable-evidence.mjs"
		, "tests/helpers/wit-recursive-acceptance.mjs"
		, "tests/jvm-structured-callable-contract.test.mjs"
		, "tests/jvm-structured-callable-evidence.test.mjs"
	]);
export const structuredCallableProducerReplayRepairImplementationPaths
	= Object.freeze([
		...structuredCallableProducerReplayRepairModifiedPaths
		, ...structuredCallableProducerReplayRepairImplementationAddedPaths
	]);
export const structuredCallableProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/jvm-callable-evidence.test.mjs"
	]);
export const structuredCallableProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...structuredCallableProducerReplayRepairModifiedPaths
		, ...structuredCallableProducerReplayRepairIntegrationPaths
	]);
export const structuredCallableProducerReplayRepairAddedPaths
	= Object.freeze([
		...structuredCallableProducerReplayRepairImplementationAddedPaths
		, "scripts/update-structured-callable-producer-replay-repair-source-history.mjs"
		, "tests/helpers/structured-callable-producer-replay-repair-source-history-tests.mjs"
		, "tests/helpers/structured-callable-producer-replay-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	structuredCallableProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseStructuredCallableProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(structuredCallableProducerReplayRepairNormalizationPaths
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
 * Remove only the exact structured-callable producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeStructuredCallableProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !structuredCallableProducerReplayRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseStructuredCallableProducerReplayRepairUpdate(source, update)
		: source;
};
