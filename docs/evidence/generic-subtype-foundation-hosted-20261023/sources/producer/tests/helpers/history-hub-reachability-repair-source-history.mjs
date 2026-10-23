/**
 * Restore exact multi-step history reachability across composite registration
 * gaps and prove the administrative Perl output change byte-for-byte.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const historyHubReachabilityRepairHistoryPath
	= "docs/evidence/history-hub-reachability-repair-source-history-20261018.json";
export const historyHubReachabilityRepairPredecessor
	= "c31ed24c5ca95bc222b9b52e8c4057597e0f5b21";
export const historyHubReachabilityRepairDraftParent
	= "c31ed24c5ca95bc222b9b52e8c4057597e0f5b21";
export const historyHubReachabilityRepairChangedPaths = Object.freeze([
	"tests/helpers/checked-javascript-disposition-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/perl-copied-graph-conversions.test.mjs"
]);
export const historyHubReachabilityRepairAddedPaths = Object.freeze([
	"scripts/update-history-hub-reachability-repair-history.mjs"
	, "tests/helpers/history-hub-reachability-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	historyHubReachabilityRepairHistoryPath, "utf8"
));

const reverseEdits = (source, update) => {
	assert.equal(sha256(source), update.currentSha256);
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
	assert.equal(sha256(previous), update.previousSha256);
	return previous;
};

/**
 * Reverse one exact source transition from this repair.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseHistoryHubReachabilityRepairUpdate = (source, update) => {
	assert.ok(historyHubReachabilityRepairChangedPaths.includes(update.path));
	return reverseEdits(source, update);
};

/**
 * Remove only this exact history-hub repair layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHistoryHubReachabilityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !historyHubReachabilityRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseHistoryHubReachabilityRepairUpdate(source, update)
		: source;
};

/**
 * Reverse and authenticate the one-byte administrative Perl output change.
 *
 * @param source - Current deterministic generated C source.
 */
export const assertHistoryHubPerlOutputEdit = source => {
	const transition = record().perlOutputEdit;
	assert.deepEqual(Object.keys(transition).sort(), [
		"currentSourceSha256", "edits", "historyPath", "historySha256"
		, "previousSourceSha256", "receiptPath", "receiptSha256"
	]);
	assert.equal(sha256(readFileSync(transition.historyPath))
		, transition.historySha256);
	assert.equal(sha256(readFileSync(transition.receiptPath))
		, transition.receiptSha256);
	return reverseEdits(source, {
		currentSha256: transition.currentSourceSha256
		, previousSha256: transition.previousSourceSha256
		, edits: transition.edits
	});
};
