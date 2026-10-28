/**
 * Reverse the explicit Owned milestone producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedMilestoneProducerRepairHistoryPath
	= "docs/evidence/owned-milestone-producer-repair-source-history-20261024.json";
export const ownedMilestoneProducerRepairPredecessor
	= "b037e571bbfa382fe8e81a2eede2416383d889ac";
export const ownedMilestoneProducerRepairImplementation
	= "a0b746c57304e6573fec15a5e270bb6ffaa59188";
export const ownedMilestoneProducerRepairIntegrationBase
	= "a0b746c57304e6573fec15a5e270bb6ffaa59188";
export const ownedMilestoneProducerRepairChangedPaths = Object.freeze([
	"tests/core-history-performance-evidence.test.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion-history.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion.mjs"
	, "tests/helpers/owned-jvm-callback-result-acceptance.mjs"
]);
export const ownedMilestoneProducerRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedMilestoneProducerRepairNormalizationPaths = Object.freeze([
	...ownedMilestoneProducerRepairChangedPaths
	, ...ownedMilestoneProducerRepairIntegrationPaths
]);
export const ownedMilestoneProducerRepairAddedPaths = Object.freeze([
	"scripts/update-owned-milestone-producer-repair-source-history.mjs"
	, "tests/helpers/owned-milestone-producer-repair-source-history-tests.mjs"
	, "tests/helpers/owned-milestone-producer-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedMilestoneProducerRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedMilestoneProducerRepairUpdate = (
	source, update
) => {
	assert.ok(ownedMilestoneProducerRepairNormalizationPaths
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
 * Remove only the exact Owned milestone producer repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedMilestoneProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedMilestoneProducerRepairNormalizationPaths.includes(path))
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
		current = reverseOwnedMilestoneProducerRepairUpdate(current, update);
	}
	return current;
};
