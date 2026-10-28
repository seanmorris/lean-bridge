/**
 * Reverse the exact transfer/borrow producer replay history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const transferBorrowProducerReplayHistoryPath
	= "docs/evidence/transfer-borrow-producer-replay-source-history-20261024.json";
export const transferBorrowProducerReplayPredecessor
	= "bda04cf67dbe423e5be4f1b452fc73d8b011f8b0";
export const transferBorrowProducerReplayImplementation
	= "37ecef8f267435ecb1ce001d389acd1694d59e49";
export const transferBorrowProducerReplayImplementationAddedPaths
	= Object.freeze([
		"tests/helpers/owned-transfer-borrow-producer-tests.mjs"
		, "tests/helpers/owned-transfer-borrow-producers.mjs"
	]);
export const transferBorrowProducerReplayModifiedPaths = Object.freeze([
	"tests/helpers/owned-cpp-transfer-evidence.mjs"
	, "tests/helpers/owned-dotnet-transfer-evidence.mjs"
	, "tests/helpers/wit-owned-borrow-evidence.mjs"
]);
export const transferBorrowProducerReplayImplementationPaths
	= Object.freeze([
		...transferBorrowProducerReplayModifiedPaths
		, ...transferBorrowProducerReplayImplementationAddedPaths
	]);
export const transferBorrowProducerReplayIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/checked-javascript.test.mjs"
	]);
export const transferBorrowProducerReplayNormalizationPaths
	= Object.freeze([
		...transferBorrowProducerReplayModifiedPaths
		, ...transferBorrowProducerReplayIntegrationPaths
	]);
export const transferBorrowProducerReplayAddedPaths = Object.freeze([
	...transferBorrowProducerReplayImplementationAddedPaths
	, "scripts/update-transfer-borrow-producer-replay-source-history.mjs"
	, "tests/helpers/transfer-borrow-producer-replay-source-history-tests.mjs"
	, "tests/helpers/transfer-borrow-producer-replay-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	transferBorrowProducerReplayHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseTransferBorrowProducerReplayUpdate = (
	source, update
) => {
	assert.ok(transferBorrowProducerReplayNormalizationPaths
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
 * Remove only the exact transfer/borrow producer replay history.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeTransferBorrowProducerReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !transferBorrowProducerReplayNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseTransferBorrowProducerReplayUpdate(source, update)
		: source;
};
