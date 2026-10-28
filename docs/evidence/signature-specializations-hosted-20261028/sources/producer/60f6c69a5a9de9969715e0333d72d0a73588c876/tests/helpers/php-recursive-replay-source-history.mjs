/**
 * Authenticate recursive PHP evidence replay with its original generator
 * and explicit source-history endpoints.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpRecursiveReplayHistoryPath
	= "docs/evidence/php-recursive-replay-source-history-20261024.json";
export const phpRecursiveReplayPredecessor
	= "0fa2f8b26fff8fa518dadb5fbc1e64980830dcde";
export const phpRecursiveReplayImplementation
	= "e61cfe73fe0bcfb1936fe7c179488e5d77be98ad";
export const phpRecursiveReplayIntegrationBase
	= "e61cfe73fe0bcfb1936fe7c179488e5d77be98ad";
export const phpRecursiveReplayCommits = Object.freeze([
	"e61cfe73fe0bcfb1936fe7c179488e5d77be98ad"
]);
export const phpRecursiveReplayChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/php-recursive-callable-evidence.mjs"
	, "tests/php-recursive-callable-evidence.test.mjs"
]);
export const phpRecursiveReplayImplementationAddedPaths = Object.freeze([
	"tests/helpers/php-recursive-producer-replay-tests.mjs"
]);
export const phpRecursiveReplayImplementationPaths = Object.freeze([
	...phpRecursiveReplayChangedPaths
	, ...phpRecursiveReplayImplementationAddedPaths
]);
export const phpRecursiveReplayIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpRecursiveReplayNormalizationPaths = Object.freeze([
	...phpRecursiveReplayChangedPaths
	, ...phpRecursiveReplayIntegrationPaths
]);
export const phpRecursiveReplayHistoryAddedPaths = Object.freeze([
	"scripts/update-php-recursive-replay-source-history.mjs"
	, "tests/helpers/php-recursive-replay-source-history-tests.mjs"
	, "tests/helpers/php-recursive-replay-source-history.mjs"
]);
export const phpRecursiveReplayAddedPaths = Object.freeze([
	...phpRecursiveReplayImplementationAddedPaths
	, ...phpRecursiveReplayHistoryAddedPaths
]);
export const phpRecursiveReplayPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/php-recursive-callable-evidence.mjs"
		, count: 3
		, previousSha256: "3df4b00e72d62cf08e202f2b366e6a23a30c7f46925b56f57cb6a27ff3a244da"
		, currentSha256: "7d2853b2576b68bce66703bee7f6707e3741373fdc54efe377143fba074d8cad"
	})
	, Object.freeze({
		path: "tests/php-recursive-callable-evidence.test.mjs"
		, count: 2
		, previousSha256: "827c0e09e618426fc4d88acb4337d064d699bb37b5ac3b86fa8abeb92f168976"
		, currentSha256: "e7a0e9de9d9d644c5eb349252c6a300994f80fc2366b00a98f51ea0e176cb179"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpRecursiveReplayHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpRecursiveReplayUpdate = (
	source, update
) => {
	assert.ok(phpRecursiveReplayNormalizationPaths
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
 * Remove only the exact Recursive PHP replay.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpRecursiveReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpRecursiveReplayNormalizationPaths.includes(path))
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
		current = reversePhpRecursiveReplayUpdate(current, update);
	}
	return current;
};
