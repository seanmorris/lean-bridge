/**
 * Preserve the complete callback-result package disk-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerCallbackDiskBudgetHistoryPath
	= "docs/evidence/consumer-callback-disk-budget-source-history-20261031.json";
export const consumerCallbackDiskBudgetPredecessor
	= "ddaa03f67159bbb6098655e4dcec60d7c121daaf";
export const consumerCallbackDiskBudgetImplementation
	= "b53016cbc97ee2a5fbc1d36d8e902390163556df";
export const consumerCallbackDiskBudgetImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
]);
export const consumerCallbackDiskBudgetImplementationAdditions
	= Object.freeze([
		"scripts/refresh-consumer-callback-disk-budget-pins.mjs"
	]);
export const consumerCallbackDiskBudgetIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const consumerCallbackDiskBudgetHistoryAdditions = Object.freeze([
	"scripts/update-consumer-callback-disk-budget-source-history.mjs"
	, "tests/helpers/consumer-callback-disk-budget-source-history-tests.mjs"
	, "tests/helpers/consumer-callback-disk-budget-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + consumerCallbackDiskBudgetHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const consumerCallbackDiskBudgetNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: consumerCallbackDiskBudgetImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => consumerCallbackDiskBudgetImplementationPaths
	.includes(path) || consumerCallbackDiskBudgetIntegrationPaths.includes(path);

/**
 * Reverse one exact callback-result disk-budget transition.
 *
 * @param source - Current source text.
 * @param update - Authenticated reversible transition.
 */
export const reverseConsumerCallbackDiskBudgetUpdate = (source, update) => {
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
 * Remove only the authenticated callback-result disk-budget transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeConsumerCallbackDiskBudgetSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerCallbackDiskBudgetNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerCallbackDiskBudgetUpdate(current, update);
	}
	return current;
};
