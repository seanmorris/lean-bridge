/**
 * Preserve the default-branch CI trigger-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const defaultBranchCiTriggerBudgetHistoryPath
	= "docs/evidence/default-branch-ci-trigger-budget-source-history-20261027.json";
export const defaultBranchCiTriggerBudgetPredecessor
	= "fae44a19c568657db6731261773c89e8ebf88f00";
export const defaultBranchCiTriggerBudgetImplementation
	= "2c1721e1650c2eda2ce4441d6d23ac1d11ca1352";
export const defaultBranchCiTriggerBudgetImplementationAdditions
	= Object.freeze(["tests/workflow-trigger-policy.test.mjs"]);
export const defaultBranchCiTriggerBudgetIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/callback-subtype-browser-ci-source-history-tests.mjs"
	, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const defaultBranchCiTriggerBudgetHistoryAdditions = Object.freeze([
	"scripts/update-default-branch-ci-trigger-budget-source-history.mjs"
	, "tests/helpers/default-branch-ci-trigger-budget-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	defaultBranchCiTriggerBudgetHistoryPath, "utf8"
));

/**
 * List every source whose current bytes participate in this transition.
 */
export const defaultBranchCiTriggerBudgetNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	defaultBranchCiTriggerBudgetIntegrationPaths.includes(path)
	|| path.startsWith(".github/workflows/")
	|| path.startsWith("tests/");

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseDefaultBranchCiTriggerBudgetUpdate = (source, update) => {
	assert.ok(allowedTransitionPath(update.path), update.path);
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
 * Remove only the authenticated trigger-budget transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeDefaultBranchCiTriggerBudgetSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	if(!updates.some(update => update.path === path)) return source;
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDefaultBranchCiTriggerBudgetUpdate(current, update);
	}
	return current;
};
