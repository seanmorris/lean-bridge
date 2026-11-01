/**
 * Preserve the fresh reviewed-source timeout-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const reviewedSourceTimeoutBudgetHistoryPath
	= "docs/evidence/reviewed-source-timeout-budget-source-history-20261101.json";
export const reviewedSourceTimeoutBudgetPredecessor
	= "c558c0922f78f5bd4b832aaecf316d87f22a987d";
export const reviewedSourceTimeoutBudgetImplementation
	= "c17907790de5f3a39219d5572d2cd0c528c38942";
export const reviewedSourceTimeoutBudgetImplementationPaths
	= Object.freeze(["tests/reviewed-source-build.test.mjs"]);
export const reviewedSourceTimeoutBudgetIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const reviewedSourceTimeoutBudgetHistoryAdditions
	= Object.freeze([
		"scripts/update-reviewed-source-timeout-budget-source-history.mjs"
		, "tests/helpers/reviewed-source-timeout-budget-source-history-tests.mjs"
		, "tests/helpers/reviewed-source-timeout-budget-source-history.mjs"
	]);

/**
 * Assert that all eight fresh reviewed-source refusal cases retain a bounded
 * budget with measured runner variance, independently of the scalar test.
 *
 * @param source - Complete reviewed-source build test.
 */
export const assertReviewedSourceTimeoutBudget = source => {
	assert.match(source
		, /fresh Lean checks review identities, record layouts, selection and drift before linking"[\s\S]*?timeout: 300_000/u);
	assert.match(source
		, /Eight fresh elaborations took 170[.]65 s[\s\S]*?Preserve every refusal case/u);
	assert.match(source
		, /fresh scalar compilation binds reviewed requests and rejects disagreement before adapters"[\s\S]*?timeout: 180_000/u);
};

const historyUrl = new URL(
	"../../" + reviewedSourceTimeoutBudgetHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const reviewedSourceTimeoutBudgetNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: reviewedSourceTimeoutBudgetImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...reviewedSourceTimeoutBudgetImplementationPaths
	, ...reviewedSourceTimeoutBudgetIntegrationPaths
].includes(path);

/**
 * Reverse one authenticated fresh reviewed-source budget transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseReviewedSourceTimeoutBudgetUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove only authenticated fresh reviewed-source budget transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeReviewedSourceTimeoutBudgetSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !reviewedSourceTimeoutBudgetNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseReviewedSourceTimeoutBudgetUpdate(current, update);
	}
	return current;
};
