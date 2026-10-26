/**
 * Preserve the Core browser-workflow evidence-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreBrowserWorkflowEvidencePinRepairHistoryPath
	= "docs/evidence/core-browser-workflow-evidence-pin-repair-source-history-20261026.json";
export const coreBrowserWorkflowEvidencePinRepairPredecessor
	= "69b041a6ce35ff18e18b1eb04f4728fdb82caed1";
export const coreBrowserWorkflowEvidencePinRepairImplementation
	= "8cb686ccd2e02ee5f963d79c1977bd80057715ca";
export const coreBrowserWorkflowEvidencePinRepairImplementationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/core-contract-evidence-tests.mjs"
	]);
export const coreBrowserWorkflowEvidencePinRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreBrowserWorkflowEvidencePinRepairNormalizationPaths
	= Object.freeze([
		...coreBrowserWorkflowEvidencePinRepairImplementationPaths
		, ...coreBrowserWorkflowEvidencePinRepairIntegrationPaths
	]);
export const coreBrowserWorkflowEvidencePinRepairAddedPaths = Object.freeze([
	"scripts/update-core-browser-workflow-evidence-pin-repair-source-history.mjs"
	, "tests/helpers/core-browser-workflow-evidence-pin-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreBrowserWorkflowEvidencePinRepairHistoryPath, "utf8"
));

/**
 * Restore one exact, authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreBrowserWorkflowEvidencePinRepairUpdate = (
	source, update
) => {
	assert.ok(coreBrowserWorkflowEvidencePinRepairNormalizationPaths.includes(
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
 * Remove only the authenticated browser-workflow evidence-pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreBrowserWorkflowEvidencePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreBrowserWorkflowEvidencePinRepairNormalizationPaths.includes(path))
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
		current = reverseCoreBrowserWorkflowEvidencePinRepairUpdate(
			current, update
		);
	}
	return current;
};
