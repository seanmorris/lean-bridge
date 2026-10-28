/**
 * Reverse the exact staged PHP producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const stagedPhpProducerReplayRepairHistoryPath
	= "docs/evidence/staged-php-producer-replay-repair-source-history-20261023.json";
export const stagedPhpProducerReplayRepairPredecessor
	= "74da75c77d7003edb4a8cb05eacb1d936cf5f716";
export const stagedPhpProducerReplayRepairImplementation
	= "94cb6c19fdd806e0ca9cdb26c5259099e9fb3fe6";
export const stagedPhpProducerReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/owned-php-callback-result-runtime-sources.mjs"
]);
export const stagedPhpProducerReplayRepairImplementationPaths
	= stagedPhpProducerReplayRepairModifiedPaths;
export const stagedPhpProducerReplayRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-jvm-callback-result-history.test.mjs"
]);
export const stagedPhpProducerReplayRepairNormalizationPaths = Object.freeze([
	...stagedPhpProducerReplayRepairModifiedPaths
	, ...stagedPhpProducerReplayRepairIntegrationPaths
]);
export const stagedPhpProducerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-staged-php-producer-replay-repair-source-history.mjs"
	, "tests/helpers/staged-php-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/staged-php-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	stagedPhpProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseStagedPhpProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(stagedPhpProducerReplayRepairNormalizationPaths
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
 * Remove only the exact staged PHP producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeStagedPhpProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !stagedPhpProducerReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseStagedPhpProducerReplayRepairUpdate(source, update)
		: source;
};
