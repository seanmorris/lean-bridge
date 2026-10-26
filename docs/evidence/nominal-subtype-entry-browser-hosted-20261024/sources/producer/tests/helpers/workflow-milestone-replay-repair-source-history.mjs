/**
 * Reverse the exact workflow-milestone replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const workflowMilestoneReplayRepairHistoryPath
	= "docs/evidence/workflow-milestone-replay-repair-source-history-20261023.json";
export const workflowMilestoneReplayRepairPredecessor
	= "e1294bf2a053c88b72317a46dd57b31ea84f5819";
export const workflowMilestoneReplayRepairImplementation
	= "a918f53b32daac340473c122c3854d13c0398820";
export const workflowMilestoneReplayRepairChangedPaths = Object.freeze([
	"tests/helpers/jvm-shard-ci-tests.mjs"
	, "tests/helpers/php-wasm-corpus-partition-tests.mjs"
]);
export const workflowMilestoneReplayRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-php-wasm-ci.test.mjs"
]);
export const workflowMilestoneReplayRepairNormalizationPaths = Object.freeze([
	...workflowMilestoneReplayRepairChangedPaths
	, ...workflowMilestoneReplayRepairIntegrationPaths
]);
export const workflowMilestoneReplayRepairAddedPaths = Object.freeze([
	"scripts/update-workflow-milestone-replay-repair-source-history.mjs"
	, "tests/helpers/workflow-milestone-replay-repair-source-history-tests.mjs"
	, "tests/helpers/workflow-milestone-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	workflowMilestoneReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseWorkflowMilestoneReplayRepairUpdate = (source, update) => {
	assert.ok(workflowMilestoneReplayRepairNormalizationPaths
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
 * Remove only the exact workflow-milestone replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeWorkflowMilestoneReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !workflowMilestoneReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseWorkflowMilestoneReplayRepairUpdate(source, update)
		: source;
};
