/**
 * Reverse the exact callback-staging lineage-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackStagingLineageReplayRepairHistoryPath
	= "docs/evidence/callback-staging-lineage-replay-repair-source-history-20261023.json";
export const callbackStagingLineageReplayRepairPredecessor
	= "e1efda2e67819dff48537b12c8297ae05a27c99a";
export const callbackStagingLineageReplayRepairImplementation
	= "5096195e2e75a4947e88ff7f5340c9c3a1dd8569";
export const callbackStagingLineageReplayRepairChangedPaths = Object.freeze([
	"tests/helpers/php-callback-installed-staging-history-tests.mjs"
	, "tests/helpers/php-callback-installed-staging-history.mjs"
	, "tests/helpers/post-perl-callback-staging-history-tests.mjs"
	, "tests/helpers/post-perl-callback-staging-history.mjs"
	, "tests/helpers/producer-source.mjs"
]);
export const callbackStagingLineageReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-jvm-callback-result-history.test.mjs"
	]);
export const callbackStagingLineageReplayRepairNormalizationPaths
	= Object.freeze([
		...callbackStagingLineageReplayRepairChangedPaths
		, ...callbackStagingLineageReplayRepairIntegrationPaths
	]);
export const callbackStagingLineageReplayRepairAddedPaths = Object.freeze([
	"scripts/update-callback-staging-lineage-replay-repair-source-history.mjs"
	, "tests/helpers/callback-staging-lineage-replay-repair-source-history-tests.mjs"
	, "tests/helpers/callback-staging-lineage-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackStagingLineageReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackStagingLineageReplayRepairUpdate = (
	source, update
) => {
	assert.ok(callbackStagingLineageReplayRepairNormalizationPaths
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
 * Remove only the exact callback-staging lineage-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackStagingLineageReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackStagingLineageReplayRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackStagingLineageReplayRepairUpdate(source, update)
		: source;
};
