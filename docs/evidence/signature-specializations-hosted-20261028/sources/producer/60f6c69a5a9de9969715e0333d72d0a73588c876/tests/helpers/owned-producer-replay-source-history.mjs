/**
 * Reverse the producer-bound replay of the staged C transfer and owned JVM
 * runtime verifiers. Both now regenerate historical evidence with the exact
 * producer modules named by their receipts instead of today's generators.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedProducerReplayHistoryPath
	= "docs/evidence/owned-producer-replay-source-history-20261024.json";
export const ownedProducerReplayPredecessor
	= "49df58c8bacf9641bdea03dac5627d4aa4699358";
export const ownedProducerReplayImplementation
	= "32e9ac1fd761e3ef4d653ebdbc68f4f9e3d7d485";
export const ownedProducerReplayCommits = Object.freeze([
	"17fe7e9e4216bdefaa3d81e63efb87812c05d00f"
	, "32e9ac1fd761e3ef4d653ebdbc68f4f9e3d7d485"
]);
export const ownedProducerReplayChangedPaths = Object.freeze([
	"tests/helpers/owned-jvm-runtime-evidence.mjs"
	, "tests/helpers/owned-transfer-c-evidence.mjs"
]);
export const ownedProducerReplayNormalizationPaths
	= ownedProducerReplayChangedPaths;
export const ownedProducerReplayAddedPaths = Object.freeze([
	"scripts/update-owned-producer-replay-source-history.mjs"
	, "tests/helpers/owned-producer-replay-source-history-tests.mjs"
	, "tests/helpers/owned-producer-replay-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedProducerReplayHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseOwnedProducerReplayUpdate = (source, update) => {
	assert.ok(ownedProducerReplayNormalizationPaths.includes(update.path));
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
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeOwnedProducerReplaySource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ownedProducerReplayNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedProducerReplayUpdate(source, update);
};
