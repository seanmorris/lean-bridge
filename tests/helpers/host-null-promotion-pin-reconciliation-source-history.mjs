/**
 * Preserve the bounded HostNull promotion source-pin reconciliation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullPromotionPinReconciliationHistoryPath
	= "docs/evidence/host-null-promotion-pin-reconciliation-source-history-20261030.json";
export const hostNullPromotionPinReconciliationPredecessor
	= "4982d2336670114858cb4f001540495f5c764929";
export const hostNullPromotionPinReconciliationImplementation
	= "c127e6a4df636d0be022fb9dee0162ecfb9268fc";
export const hostNullPromotionPinReconciliationImplementationPaths
	= Object.freeze([
		"scripts/promote-host-null-complete.mjs"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/host-null-complete-promotion-transaction-tests.mjs"
		, "tests/helpers/host-null-complete-promotion.mjs"
	]);
export const hostNullPromotionPinReconciliationImplementationAdditions
	= Object.freeze([
		"tests/helpers/host-null-complete-source-pin-reconciliation-tests.mjs"
		, "tests/helpers/host-null-complete-source-pin-reconciliation.mjs"
	]);
export const hostNullPromotionPinReconciliationIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const hostNullPromotionPinReconciliationHistoryAdditions
	= Object.freeze([
		"scripts/update-host-null-promotion-pin-reconciliation-source-history.mjs"
		, "tests/helpers/host-null-promotion-pin-reconciliation-source-history-tests.mjs"
		, "tests/helpers/host-null-promotion-pin-reconciliation-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${hostNullPromotionPinReconciliationHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const hostNullPromotionPinReconciliationNormalizationPaths
	= Object.freeze([...new Set([
		...hostNullPromotionPinReconciliationImplementationPaths
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	hostNullPromotionPinReconciliationImplementationPaths.includes(path)
	|| hostNullPromotionPinReconciliationIntegrationPaths.includes(path);

/**
 * Reverse one exact authenticated transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseHostNullPromotionPinReconciliationUpdate = (
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
 * Remove only the authenticated reconciliation milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostNullPromotionPinReconciliationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !hostNullPromotionPinReconciliationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullPromotionPinReconciliationUpdate(
				current, update);
	}
	return current;
};
