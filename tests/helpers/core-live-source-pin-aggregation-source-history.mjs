/**
 * Preserve complete live-source pin aggregation and reconciliation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreLiveSourcePinAggregationHistoryPath
	= "docs/evidence/core-live-source-pin-aggregation-source-history-20261031.json";
export const coreLiveSourcePinAggregationPredecessor
	= "79694405b9da5dc2d2169261448d3dfc70c32f6c";
export const coreLiveSourcePinAggregationImplementation
	= "b678316c24267ada5ed011ca73d33ddaa7c50662";
export const coreLiveSourcePinAggregationImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/type-surface.mjs"
	, "tests/helpers/core-contract-evidence-tests.mjs"
]);
export const coreLiveSourcePinAggregationIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreLiveSourcePinAggregationHistoryAdditions = Object.freeze([
	"scripts/update-core-live-source-pin-aggregation-source-history.mjs"
	, "tests/helpers/core-live-source-pin-aggregation-source-history-tests.mjs"
	, "tests/helpers/core-live-source-pin-aggregation-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + coreLiveSourcePinAggregationHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreLiveSourcePinAggregationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: coreLiveSourcePinAggregationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => coreLiveSourcePinAggregationImplementationPaths
	.includes(path) || coreLiveSourcePinAggregationIntegrationPaths.includes(path);

/**
 * Reverse one exact live-source aggregation transition.
 *
 * @param source - Current source text.
 * @param update - Authenticated reversible transition.
 */
export const reverseCoreLiveSourcePinAggregationUpdate = (source, update) => {
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
 * Remove only the authenticated live-source aggregation transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeCoreLiveSourcePinAggregationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreLiveSourcePinAggregationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreLiveSourcePinAggregationUpdate(current, update);
	}
	return current;
};
