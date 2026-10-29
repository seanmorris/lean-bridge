/**
 * Preserve the exact optional-parameter promotion contract preparation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterPromotionContractHistoryPath
	= "docs/evidence/optional-parameter-promotion-contract-source-history-20261029.json";
export const optionalParameterPromotionContractPredecessor
	= "d255e35c5e940af999cc4ce173cec1b1ec0af913";
export const optionalParameterPromotionContractImplementation
	= "d3e10a3b0a34a0e14f8d91c5aee2e38912addebe";
export const optionalParameterPromotionContractImplementationPaths
	= Object.freeze(["tests/checked-javascript-partition-11.test.mjs"]);
export const optionalParameterPromotionContractImplementationAdditions
	= Object.freeze([
		"tests/helpers/optional-parameter-complete-promotion-tests.mjs"
		, "tests/helpers/optional-parameter-complete-promotion.mjs"
	]);
export const optionalParameterPromotionContractIntegrationPaths
	= Object.freeze(["tests/canonical-package-manifest.test.mjs"]);
export const optionalParameterPromotionContractHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-promotion-contract-source-history.mjs"
		, "tests/helpers/optional-parameter-promotion-contract-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-promotion-contract-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterPromotionContractHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterPromotionContractNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: optionalParameterPromotionContractImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => optionalParameterPromotionContractImplementationPaths
	.includes(path) || optionalParameterPromotionContractIntegrationPaths
	.includes(path);

/**
 * Reverse one exact promotion-contract transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterPromotionContractUpdate = (
	source, update
) => {
	assert.ok(allowed(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const pieces = [];
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
		pieces.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	pieces.push(source.slice(cursor));
	const previous = pieces.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove the preparation from current or historical source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterPromotionContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterPromotionContractNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseOptionalParameterPromotionContractUpdate(
			current, update);
	}
	return current;
};
