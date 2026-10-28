/**
 * Reverse the exact owned JavaScript transfer producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedJavaScriptTransferProducerReplayRepairHistoryPath
	= "docs/evidence/owned-javascript-transfer-producer-replay-repair-source-history-20261023.json";
export const ownedJavaScriptTransferProducerReplayRepairPredecessor
	= "04840d09e3d5d39ec799b5147103dc3196ac7f7e";
export const ownedJavaScriptTransferProducerReplayRepairImplementation
	= "f53fac928cb08d35880eb14510e085043e9513f9";
export const ownedJavaScriptTransferProducerReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/owned-javascript-transfer-evidence.mjs"
	, "tests/helpers/producer-module.mjs"
]);
export const ownedJavaScriptTransferProducerReplayRepairImplementationPaths
	= ownedJavaScriptTransferProducerReplayRepairModifiedPaths;
export const ownedJavaScriptTransferProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-javascript-transfer-evidence.test.mjs"
	]);
export const ownedJavaScriptTransferProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...ownedJavaScriptTransferProducerReplayRepairModifiedPaths
		, ...ownedJavaScriptTransferProducerReplayRepairIntegrationPaths
	]);
export const ownedJavaScriptTransferProducerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-owned-javascript-transfer-producer-replay-repair-source-history.mjs"
	, "tests/helpers/owned-javascript-transfer-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/owned-javascript-transfer-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedJavaScriptTransferProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedJavaScriptTransferProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(ownedJavaScriptTransferProducerReplayRepairNormalizationPaths
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
 * Remove only the exact owned JavaScript transfer producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedJavaScriptTransferProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedJavaScriptTransferProducerReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedJavaScriptTransferProducerReplayRepairUpdate(source, update)
		: source;
};
