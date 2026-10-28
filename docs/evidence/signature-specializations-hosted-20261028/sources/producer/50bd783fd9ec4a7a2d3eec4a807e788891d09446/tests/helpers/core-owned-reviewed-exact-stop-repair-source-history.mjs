/**
 * Preserve the exact owned-reviewed evidence stopping-boundary repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreOwnedReviewedExactStopRepairHistoryPath
	= "docs/evidence/core-owned-reviewed-exact-stop-repair-source-history-20261026.json";
export const coreOwnedReviewedExactStopRepairPredecessor
	= "c3750e65905c25b4feb76c842edfeaa68d661712";
export const coreOwnedReviewedExactStopRepairImplementation
	= "d33c8639c3d42169b5e9b13b89557e9bd7e6c93d";
export const coreOwnedReviewedExactStopRepairImplementationPaths
	= Object.freeze([
		"tests/owned-reviewed-evidence.test.mjs"
	]);
export const coreOwnedReviewedExactStopRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreOwnedReviewedExactStopRepairNormalizationPaths
	= Object.freeze([
		...coreOwnedReviewedExactStopRepairImplementationPaths
		, ...coreOwnedReviewedExactStopRepairIntegrationPaths
	]);
export const coreOwnedReviewedExactStopRepairAddedPaths = Object.freeze([
	"scripts/update-core-owned-reviewed-exact-stop-repair-source-history.mjs"
	, "tests/helpers/core-owned-reviewed-exact-stop-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreOwnedReviewedExactStopRepairHistoryPath, "utf8"
));

/**
 * Restore one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreOwnedReviewedExactStopRepairUpdate = (
	source, update
) => {
	assert.ok(coreOwnedReviewedExactStopRepairNormalizationPaths
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated owned-reviewed exact-stop repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreOwnedReviewedExactStopRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreOwnedReviewedExactStopRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreOwnedReviewedExactStopRepairUpdate(
			current, update);
	}
	return current;
};
