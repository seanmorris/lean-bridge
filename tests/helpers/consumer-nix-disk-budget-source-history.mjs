/**
 * Preserve the complete Consumer Matrix Nix disk-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerNixDiskBudgetHistoryPath
	= "docs/evidence/consumer-nix-disk-budget-source-history-20261031.json";
export const consumerNixDiskBudgetPredecessor
	= "a2b1097dfebabc4f5377d262eb4e04c0139058c3";
export const consumerNixDiskBudgetImplementation
	= "ef1a208c25701444aec6451075d6ee94760a02be";
export const consumerNixDiskBudgetPins = Object.freeze([
	Object.freeze({
		path: ".github/workflows/consumer-matrix.yml", count: 92
		, previous: "b2b54c778b971a195b5568d7321cd008ff469e1e4ea9563e57e946236aa30162"
		, current: "6553b5e69d2373bb7e255fdde3a0f549bf745ce7694214c74194007d991f3a4f"
	})
	, Object.freeze({
		path: "tests/documentation.test.mjs", count: 25
		, previous: "46e2b1ae429c45758085bcff5687f8a835a319fa8cc4ae4498270408a97b34c4"
		, current: "c626288496cbb69719b570b8e987b2875c0fe48080078b008b047086a6325837"
	})
]);
export const consumerNixDiskBudgetImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
]);
export const consumerNixDiskBudgetIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const consumerNixDiskBudgetHistoryAdditions = Object.freeze([
	"scripts/update-consumer-nix-disk-budget-source-history.mjs"
	, "tests/helpers/consumer-nix-disk-budget-source-history-tests.mjs"
	, "tests/helpers/consumer-nix-disk-budget-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + consumerNixDiskBudgetHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const consumerNixDiskBudgetNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: consumerNixDiskBudgetImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => consumerNixDiskBudgetImplementationPaths
	.includes(path) || consumerNixDiskBudgetIntegrationPaths.includes(path);

/**
 * Reverse one exact Consumer Matrix disk-budget transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseConsumerNixDiskBudgetUpdate = (source, update) => {
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
 * Remove only the authenticated Consumer Matrix disk-budget transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 * @returns {string} Normalized source.
 */
export const beforeConsumerNixDiskBudgetSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerNixDiskBudgetNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerNixDiskBudgetUpdate(current, update);
	}
	return current;
};
