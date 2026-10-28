/**
 * Reverse the exact owned Python borrow producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedPythonBorrowProducerReplayRepairHistoryPath
	= "docs/evidence/owned-python-borrow-producer-replay-repair-source-history-20261023.json";
export const ownedPythonBorrowProducerReplayRepairPredecessor
	= "a04af88c07894caa241029caa3f725a35876f029";
export const ownedPythonBorrowProducerReplayRepairImplementation
	= "0140e90ef36b92c5101dc40ce342fe1e430f7582";
export const ownedPythonBorrowProducerReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/owned-python-borrow-evidence.mjs"
]);
export const ownedPythonBorrowProducerReplayRepairImplementationPaths
	= ownedPythonBorrowProducerReplayRepairModifiedPaths;
export const ownedPythonBorrowProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-python-borrow-evidence.test.mjs"
	]);
export const ownedPythonBorrowProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...ownedPythonBorrowProducerReplayRepairModifiedPaths
		, ...ownedPythonBorrowProducerReplayRepairIntegrationPaths
	]);
export const ownedPythonBorrowProducerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-owned-python-borrow-producer-replay-repair-source-history.mjs"
	, "tests/helpers/owned-python-borrow-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/owned-python-borrow-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedPythonBorrowProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedPythonBorrowProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(ownedPythonBorrowProducerReplayRepairNormalizationPaths
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
 * Remove only the exact owned Python borrow producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedPythonBorrowProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedPythonBorrowProducerReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedPythonBorrowProducerReplayRepairUpdate(source, update)
		: source;
};
