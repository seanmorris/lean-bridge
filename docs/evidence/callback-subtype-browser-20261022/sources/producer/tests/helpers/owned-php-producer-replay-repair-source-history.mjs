/**
 * Reverse the exact owned PHP producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedPhpProducerReplayRepairHistoryPath
	= "docs/evidence/owned-php-producer-replay-repair-source-history-20261023.json";
export const ownedPhpProducerReplayRepairPredecessor
	= "739dfe583af93dad411be8bf256e6a72ace33722";
export const ownedPhpProducerReplayRepairImplementation
	= "699fe662539b9de6fe24526866fe875b146fa337";
export const ownedPhpProducerReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/owned-php-borrow-evidence.mjs"
	, "tests/helpers/owned-php-package-evidence.mjs"
]);
export const ownedPhpProducerReplayRepairImplementationPaths
	= ownedPhpProducerReplayRepairModifiedPaths;
export const ownedPhpProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-php-borrow-evidence.test.mjs"
	]);
export const ownedPhpProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...ownedPhpProducerReplayRepairModifiedPaths
		, ...ownedPhpProducerReplayRepairIntegrationPaths
	]);
export const ownedPhpProducerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-owned-php-producer-replay-repair-source-history.mjs"
	, "tests/helpers/owned-php-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/owned-php-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedPhpProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedPhpProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(ownedPhpProducerReplayRepairNormalizationPaths
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
 * Remove only the exact owned PHP producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedPhpProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedPhpProducerReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedPhpProducerReplayRepairUpdate(source, update)
		: source;
};
