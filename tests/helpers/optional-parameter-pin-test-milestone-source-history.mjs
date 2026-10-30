/**
 * Preserve the optional pin-test milestone repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterPinTestMilestoneHistoryPath
	= "docs/evidence/optional-parameter-pin-test-milestone-source-history-20261030.json";
export const optionalParameterPinTestMilestonePredecessor
	= "c3b934d06c41a91dc7b28c519c90e9983aa4a1fe";
export const optionalParameterPinTestMilestoneImplementation
	= "f0860bc1afe7aba6eed6d45c1f0999a0e624e129";
export const optionalParameterPinTestMilestoneImplementationPaths
	= Object.freeze([
		"tests/helpers/optional-parameter-promotion-io-pin-repair-tests.mjs"
	]);
export const optionalParameterPinTestMilestoneIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const optionalParameterPinTestMilestoneHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-pin-test-milestone-source-history.mjs"
		, "tests/helpers/optional-parameter-pin-test-milestone-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-pin-test-milestone-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterPinTestMilestoneHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterPinTestMilestoneNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: optionalParameterPinTestMilestoneImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	optionalParameterPinTestMilestoneImplementationPaths.includes(path)
	|| optionalParameterPinTestMilestoneIntegrationPaths.includes(path);

/**
 * Reverse one authenticated optional pin-test transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseOptionalParameterPinTestMilestoneUpdate
	= (source, update) => {
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
 * Remove only the authenticated optional pin-test repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOptionalParameterPinTestMilestoneSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterPinTestMilestoneNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterPinTestMilestoneUpdate(
				current, update);
	}
	return current;
};
