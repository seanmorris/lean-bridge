/**
 * Preserve the exact-head Core live source-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreExactHeadLivePinRepairHistoryPath
	= "docs/evidence/core-exact-head-live-pin-repair-source-history-20261026.json";
export const coreExactHeadLivePinRepairPredecessor
	= "16e97c0e501d3faa450acde2cec8de679a12194e";
export const coreExactHeadLivePinRepairImplementation
	= "d4574b6b3055f29a5470c5cc95b53f5f57aad2dd";
export const coreExactHeadLivePinRepairImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const coreExactHeadLivePinRepairIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreExactHeadLivePinRepairNormalizationPaths = Object.freeze([
	...coreExactHeadLivePinRepairImplementationPaths
	, ...coreExactHeadLivePinRepairIntegrationPaths
]);
export const coreExactHeadLivePinRepairAddedPaths = Object.freeze([
	"scripts/update-core-exact-head-live-pin-repair-source-history.mjs"
	, "tests/helpers/core-exact-head-live-pin-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreExactHeadLivePinRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreExactHeadLivePinRepairUpdate = (source, update) => {
	assert.ok(coreExactHeadLivePinRepairNormalizationPaths.includes(
		update.path
	));
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
 * Remove only the authenticated exact-head live-pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreExactHeadLivePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreExactHeadLivePinRepairNormalizationPaths.includes(path))
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
		current = reverseCoreExactHeadLivePinRepairUpdate(current, update);
	}
	return current;
};
