/**
 * Authenticate the producer-bound C/JVM replay integration and exact
 * historical PHP/Perl fixture, inventory and additions checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedHistoryFollowupHistoryPath
	= "docs/evidence/owned-history-followup-source-history-20261024.json";
export const ownedHistoryFollowupPredecessor
	= "49df58c8bacf9641bdea03dac5627d4aa4699358";
export const ownedHistoryFollowupImplementation
	= "746551e1bd040960a6239af8348b1315e8c6d3de";
export const ownedHistoryFollowupIntegrationBase
	= "746551e1bd040960a6239af8348b1315e8c6d3de";
export const ownedHistoryFollowupCommits = Object.freeze([
	"17fe7e9e4216bdefaa3d81e63efb87812c05d00f"
	, "32e9ac1fd761e3ef4d653ebdbc68f4f9e3d7d485"
	, "6765abe1df0db64d8fa7377e1c998090e0efb69e"
	, "2652e77c8d8e2c2bc69ecd57c7947453d7c64d4f"
	, "746551e1bd040960a6239af8348b1315e8c6d3de"
]);
export const ownedHistoryFollowupChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/owned-jvm-runtime-evidence.mjs"
	, "tests/helpers/owned-transfer-c-evidence.mjs"
	, "tests/owned-transfer-c-evidence.test.mjs"
	, "tests/helpers/owned-perl-package-evidence.mjs"
	, "tests/helpers/php-recursive-callable-evidence.mjs"
	, "tests/owned-perl-package-evidence.test.mjs"
	, "tests/helpers/checked-record-value-index-rust-promotion-source-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-native-review-source-history-tests.mjs"
]);
export const ownedHistoryFollowupImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-producer-replay-source-history-20261024.json"
	, "scripts/update-owned-producer-replay-source-history.mjs"
	, "tests/helpers/owned-producer-replay-source-history-tests.mjs"
	, "tests/helpers/owned-producer-replay-source-history.mjs"
	, "tests/helpers/php-recursive-milestone-stop-tests.mjs"
]);
export const ownedHistoryFollowupImplementationPaths = Object.freeze([
	...ownedHistoryFollowupChangedPaths
	, ...ownedHistoryFollowupImplementationAddedPaths
]);
export const ownedHistoryFollowupIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedHistoryFollowupNormalizationPaths = Object.freeze([
	...ownedHistoryFollowupChangedPaths
	, ...ownedHistoryFollowupIntegrationPaths
]);
export const ownedHistoryFollowupHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-history-followup-source-history.mjs"
	, "tests/helpers/owned-history-followup-source-history-tests.mjs"
	, "tests/helpers/owned-history-followup-source-history.mjs"
]);
export const ownedHistoryFollowupAddedPaths = Object.freeze([
	...ownedHistoryFollowupImplementationAddedPaths
	, ...ownedHistoryFollowupHistoryAddedPaths
]);
export const ownedHistoryFollowupPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/php-recursive-callable-evidence.mjs"
		, count: 3
		, previousSha256: "d3498a362e04a92ffbd34b59ddff4277ab839beebdc5efe51da488c7b563db63"
		, currentSha256: "3df4b00e72d62cf08e202f2b366e6a23a30c7f46925b56f57cb6a27ff3a244da"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedHistoryFollowupHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedHistoryFollowupUpdate = (
	source, update
) => {
	assert.ok(ownedHistoryFollowupNormalizationPaths
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
 * Remove only the exact Owned history follow-up.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedHistoryFollowupSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedHistoryFollowupNormalizationPaths.includes(path))
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
		current = reverseOwnedHistoryFollowupUpdate(current, update);
	}
	return current;
};
