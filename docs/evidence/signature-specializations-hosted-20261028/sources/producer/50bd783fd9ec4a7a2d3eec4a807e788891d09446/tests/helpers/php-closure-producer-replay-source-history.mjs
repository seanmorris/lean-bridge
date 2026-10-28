/**
 * Authenticate the exact-producer PHP and closure regression replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpClosureProducerReplayHistoryPath
	= "docs/evidence/php-closure-producer-replay-source-history-20261025.json";
export const phpClosureProducerReplayPredecessor
	= "a615a9c0e9586bdd6716a447e845b3a85146e7b1";
export const phpClosureProducerReplayImplementation
	= "44e71a78c5ab2700dc4511e5d5b88b991ed5cf74";
export const phpClosureProducerReplayIntegrationBase
	= "44e71a78c5ab2700dc4511e5d5b88b991ed5cf74";
export const phpClosureProducerReplayCommits = Object.freeze([
	"44e71a78c5ab2700dc4511e5d5b88b991ed5cf74"
]);
export const phpClosureProducerReplayChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/closure-thread-evidence.test.mjs"
	, "tests/helpers/closure-thread-evidence.mjs"
	, "tests/helpers/php-ci-regression-evidence.mjs"
	, "tests/php-ci-regression-evidence.test.mjs"
]);
export const phpClosureProducerReplayImplementationAddedPaths = Object.freeze([
	"tests/helpers/php-closure-producer-replay-tests.mjs"
]);
export const phpClosureProducerReplayImplementationPaths = Object.freeze([
	...phpClosureProducerReplayChangedPaths
	, ...phpClosureProducerReplayImplementationAddedPaths
]);
export const phpClosureProducerReplayIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpClosureProducerReplayNormalizationPaths = Object.freeze([
	...phpClosureProducerReplayChangedPaths
	, ...phpClosureProducerReplayIntegrationPaths
]);
export const phpClosureProducerReplayHistoryAddedPaths = Object.freeze([
	"scripts/update-php-closure-producer-replay-source-history.mjs"
	, "tests/helpers/php-closure-producer-replay-source-history-tests.mjs"
	, "tests/helpers/php-closure-producer-replay-source-history.mjs"
]);
export const phpClosureProducerReplayAddedPaths = Object.freeze([
	...phpClosureProducerReplayImplementationAddedPaths
	, ...phpClosureProducerReplayHistoryAddedPaths
]);
export const phpClosureProducerReplayPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/php-ci-regression-evidence.mjs", count: 2
		, previousSha256: "1ec2bb17b430d9001252a56c3fc712ea37c2a76ec0edb4d8ba71a2056f6581be"
		, currentSha256: "0a25177d465ca652f5c6fbac101010e46783093d9a5fc76a97a8d127ffe0e2de"
	})
	, Object.freeze({
		path: "tests/php-ci-regression-evidence.test.mjs", count: 1
		, previousSha256: "fdd26b81ab0b45ba6fabfc36a19518a7409e5462fb9a66a25918a23f288bbc24"
		, currentSha256: "56f32ba86917df95c664f1d508c640e98619a888e4a3a14af99a24a54202e543"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpClosureProducerReplayHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpClosureProducerReplayUpdate = (
	source, update
) => {
	assert.ok(phpClosureProducerReplayNormalizationPaths
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
 * Remove only the exact PHP and closure producer replay.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpClosureProducerReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpClosureProducerReplayNormalizationPaths.includes(path))
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
		current = reversePhpClosureProducerReplayUpdate(current, update);
	}
	return current;
};
