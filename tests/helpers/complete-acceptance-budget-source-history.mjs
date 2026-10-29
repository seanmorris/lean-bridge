/**
 * Preserve the bounded proof-erasure and HostNull completion workflows.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const completeAcceptanceBudgetHistoryPath
	= "docs/evidence/complete-acceptance-budget-source-history-20261029.json";
export const completeAcceptanceBudgetPredecessor
	= "449f858a9bad7890466079fd959ef6421771826a";
export const completeAcceptanceBudgetImplementation
	= "0da9138d991bf36755bcb16bf42e87fabcec8271";
export const completeAcceptanceBudgetImplementationPaths = Object.freeze([
	".github/workflows/direct-proof-erasure-complete.yml"
	, ".github/workflows/host-null-complete.yml"
	, "tests/helpers/direct-proof-erasure-complete-ci-tests.mjs"
	, "tests/helpers/host-null-complete-ci-tests.mjs"
]);
export const completeAcceptanceBudgetIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const completeAcceptanceBudgetHistoryAdditions = Object.freeze([
	"scripts/update-complete-acceptance-budget-source-history.mjs"
	, "tests/helpers/complete-acceptance-budget-source-history-tests.mjs"
	, "tests/helpers/complete-acceptance-budget-source-history.mjs"
]);

const historyUrl = new URL(`../../${completeAcceptanceBudgetHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const completeAcceptanceBudgetNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: completeAcceptanceBudgetImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => completeAcceptanceBudgetImplementationPaths.includes(path)
	|| completeAcceptanceBudgetIntegrationPaths.includes(path);

/**
 * Reverse one authenticated completion-budget transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseCompleteAcceptanceBudgetUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), [
			"current", "previous", "start"
		]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only the authenticated completion-budget transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCompleteAcceptanceBudgetSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !completeAcceptanceBudgetNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCompleteAcceptanceBudgetUpdate(current, update);
	}
	return current;
};
