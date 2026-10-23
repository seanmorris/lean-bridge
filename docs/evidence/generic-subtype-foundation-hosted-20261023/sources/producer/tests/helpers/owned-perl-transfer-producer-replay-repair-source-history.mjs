/**
 * Reverse the exact owned Perl transfer producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedPerlTransferProducerReplayRepairHistoryPath
	= "docs/evidence/owned-perl-transfer-producer-replay-repair-source-history-20261023.json";
export const ownedPerlTransferProducerReplayRepairPredecessor
	= "71610fd406c51066f814e408814d53f3b1b33654";
export const ownedPerlTransferProducerReplayRepairImplementation
	= "97f5c56a38696254b0a1e16362adc6d68cbdfda6";
export const ownedPerlTransferProducerReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/owned-perl-transfer-evidence.mjs"
]);
export const ownedPerlTransferProducerReplayRepairImplementationPaths
	= ownedPerlTransferProducerReplayRepairModifiedPaths;
export const ownedPerlTransferProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-perl-transfer-evidence.test.mjs"
	]);
export const ownedPerlTransferProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...ownedPerlTransferProducerReplayRepairModifiedPaths
		, ...ownedPerlTransferProducerReplayRepairIntegrationPaths
	]);
export const ownedPerlTransferProducerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-owned-perl-transfer-producer-replay-repair-source-history.mjs"
	, "tests/helpers/owned-perl-transfer-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/owned-perl-transfer-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedPerlTransferProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedPerlTransferProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(ownedPerlTransferProducerReplayRepairNormalizationPaths
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
 * Remove only the exact owned Perl transfer producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedPerlTransferProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedPerlTransferProducerReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedPerlTransferProducerReplayRepairUpdate(source, update)
		: source;
};
