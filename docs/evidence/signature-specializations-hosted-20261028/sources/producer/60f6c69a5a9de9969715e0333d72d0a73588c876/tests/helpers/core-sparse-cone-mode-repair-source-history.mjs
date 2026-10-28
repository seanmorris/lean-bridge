/**
 * Preserve the Core sparse cone-mode repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreSparseConeModeRepairHistoryPath
	= "docs/evidence/core-sparse-cone-mode-repair-source-history-20261026.json";
export const coreSparseConeModeRepairPredecessor
	= "278ede16fa6e361dcc60093094bbdc1b97997e68";
export const coreSparseConeModeRepairImplementation
	= "54f67e3f2ea34d1876008f4609fb13aeb9a1871d";
export const coreSparseConeModeRepairImplementationPaths = Object.freeze([
	"scripts/core-contract-evidence.mjs"
	, "scripts/materialize-core-contract-evidence.mjs"
	, "tests/helpers/core-contract-evidence-tests.mjs"
]);
export const coreSparseConeModeRepairIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreSparseConeModeRepairNormalizationPaths = Object.freeze([
	...coreSparseConeModeRepairImplementationPaths
	, ...coreSparseConeModeRepairIntegrationPaths
]);
export const coreSparseConeModeRepairAddedPaths = Object.freeze([
	"scripts/update-core-sparse-cone-mode-repair-source-history.mjs"
	, "tests/helpers/core-sparse-cone-mode-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreSparseConeModeRepairHistoryPath, "utf8"
));

/**
 * Restore one exact, authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreSparseConeModeRepairUpdate = (source, update) => {
	assert.ok(coreSparseConeModeRepairNormalizationPaths.includes(update.path));
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
 * Remove only the authenticated sparse cone-mode repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreSparseConeModeRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreSparseConeModeRepairNormalizationPaths.includes(path))
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
		current = reverseCoreSparseConeModeRepairUpdate(current, update);
	}
	return current;
};
