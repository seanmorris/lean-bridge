/**
 * Preserve the exact-head callback Fin type-surface source-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreCallbackFinLivePinRepairHistoryPath
	= "docs/evidence/core-callback-fin-live-pin-repair-source-history-20261028.json";
export const coreCallbackFinLivePinRepairPredecessor
	= "fa1118871f9187e4401d3815760e802f36943ede";
export const coreCallbackFinLivePinRepairImplementation
	= "ed0209319d5f045763b26ce24de570921349ea50";
export const coreCallbackFinLivePinRepairImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const coreCallbackFinLivePinRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreCallbackFinLivePinRepairNormalizationPaths = Object.freeze([
	...coreCallbackFinLivePinRepairImplementationPaths
	, ...coreCallbackFinLivePinRepairIntegrationPaths
]);
export const coreCallbackFinLivePinRepairAddedPaths = Object.freeze([
	"scripts/update-core-callback-fin-live-pin-repair-source-history.mjs"
	, "tests/helpers/core-callback-fin-live-pin-repair-source-history-tests.mjs"
	, "tests/helpers/core-callback-fin-live-pin-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreCallbackFinLivePinRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreCallbackFinLivePinRepairUpdate = (source, update) => {
	assert.ok(coreCallbackFinLivePinRepairNormalizationPaths.includes(
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
 * Remove only the authenticated callback Fin live-pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreCallbackFinLivePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreCallbackFinLivePinRepairNormalizationPaths.includes(path))
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
		current = reverseCoreCallbackFinLivePinRepairUpdate(current, update);
	}
	return current;
};
