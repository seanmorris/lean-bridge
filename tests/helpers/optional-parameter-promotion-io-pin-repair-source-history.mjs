/**
 * Preserve the exact optional promotion-reader pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterPromotionIoPinRepairHistoryPath
	= "docs/evidence/optional-parameter-promotion-io-pin-repair-source-history-20261029.json";
export const optionalParameterPromotionIoPinRepairPredecessor
	= "21a101e02bc49809a73e9c085b88ff14e127f3e4";
export const optionalParameterPromotionIoPinRepairImplementation
	= "1ee57a8f73196ab44e2568f2bb14350c0766a44a";
export const optionalParameterPromotionIoPinRepairImplementationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
	]);
export const optionalParameterPromotionIoPinRepairImplementationAdditions
	= Object.freeze([
		"scripts/refresh-optional-parameter-promotion-io-pins.mjs"
		, "tests/helpers/optional-parameter-promotion-io-pin-repair-tests.mjs"
		, "tests/helpers/optional-parameter-promotion-io-pin-repair.mjs"
	]);
export const optionalParameterPromotionIoPinRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const optionalParameterPromotionIoPinRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-promotion-io-pin-repair-source-history.mjs"
		, "tests/helpers/optional-parameter-promotion-io-pin-repair-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-promotion-io-pin-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterPromotionIoPinRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterPromotionIoPinRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: optionalParameterPromotionIoPinRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => optionalParameterPromotionIoPinRepairImplementationPaths
	.includes(path) || optionalParameterPromotionIoPinRepairIntegrationPaths
	.includes(path);

/**
 * Reverse one authenticated promotion-reader pin transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseOptionalParameterPromotionIoPinRepairUpdate = (
	source, update
) => {
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
 * Remove authenticated promotion-reader pin transitions, newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOptionalParameterPromotionIoPinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterPromotionIoPinRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterPromotionIoPinRepairUpdate(
				current, update);
	}
	return current;
};
