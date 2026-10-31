/**
 * Preserve the downstream type-surface receipt and JVM instrumentation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerTypeSurfaceReceiptRepairHistoryPath
	= "docs/evidence/consumer-type-surface-receipt-repair-source-history-20261031.json";
export const consumerTypeSurfaceReceiptRepairPredecessor
	= "7925a22f3315a13cdf9d13869c512159637fa853";
export const consumerTypeSurfaceReceiptRepairImplementation
	= "a5eef89df2d3885970bd7e89001d7eba30891d7b";
export const consumerTypeSurfaceReceiptRepairImplementationPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "tests/docker-consumer-ci.test.mjs"
		, "tests/helpers/jvm-recursive-callable-instrument.mjs"
		, "tests/jvm-recursive-callable-contract.test.mjs"
	]);
export const consumerTypeSurfaceReceiptRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const consumerTypeSurfaceReceiptRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-consumer-type-surface-receipt-repair-source-history.mjs"
		, "tests/helpers/consumer-type-surface-receipt-repair-source-history-tests.mjs"
		, "tests/helpers/consumer-type-surface-receipt-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	"../../" + consumerTypeSurfaceReceiptRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const consumerTypeSurfaceReceiptRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: consumerTypeSurfaceReceiptRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: consumerTypeSurfaceReceiptRepairIntegrationPaths)
	])].sort());
const allowedPath = path =>
	consumerTypeSurfaceReceiptRepairImplementationPaths.includes(path)
	|| consumerTypeSurfaceReceiptRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact downstream receipt repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseConsumerTypeSurfaceReceiptRepairUpdate = (
	source, update
) => {
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
 * Remove only the authenticated downstream receipt repair transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 * @returns {string} Normalized source.
 */
export const beforeConsumerTypeSurfaceReceiptRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerTypeSurfaceReceiptRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerTypeSurfaceReceiptRepairUpdate(
				current, update);
	}
	return current;
};
