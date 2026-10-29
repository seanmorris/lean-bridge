/**
 * Preserve extraction of current optional-repair history from partition 11.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalRepairHistoryRegistrationHistoryPath
	= "docs/evidence/optional-repair-history-registration-source-history-20261029.json";
export const optionalRepairHistoryRegistrationPredecessor
	= "0d2db2671115590cd15efb2f089ad2263a5be223";
export const optionalRepairHistoryRegistrationImplementation
	= "830c9664e5f33c11b42e8afe6ca51602236f56f3";
export const optionalRepairHistoryRegistrationImplementationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/optional-parameter-installed-contract.test.mjs"
	]);
export const optionalRepairHistoryRegistrationIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/optional-parameter-installed-contract.test.mjs"
	]);
export const optionalRepairHistoryRegistrationHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-repair-history-registration-source-history.mjs"
		, "tests/helpers/optional-repair-history-registration-source-history-tests.mjs"
		, "tests/helpers/optional-repair-history-registration-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalRepairHistoryRegistrationHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalRepairHistoryRegistrationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: optionalRepairHistoryRegistrationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => optionalRepairHistoryRegistrationImplementationPaths
	.includes(path) || optionalRepairHistoryRegistrationIntegrationPaths
	.includes(path);

/**
 * Reverse one exact registration transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalRepairHistoryRegistrationUpdate = (
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
 * Remove the registration transition from current or historical source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalRepairHistoryRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalRepairHistoryRegistrationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseOptionalRepairHistoryRegistrationUpdate(
			current, update);
	}
	return current;
};
