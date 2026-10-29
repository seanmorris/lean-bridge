/**
 * Preserve the optional-parameter installed checker repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterPackageCheckerRepairHistoryPath
	= "docs/evidence/optional-parameter-package-checker-repair-source-history-20261029.json";
export const optionalParameterPackageCheckerRepairPredecessor
	= "2446f6c1d7fc3acaf616d14b78bd8ff0bc3a1708";
export const optionalParameterPackageCheckerRepairImplementation
	= "3c3ff9f21aac1f317add78cb3ae18c786747490b";
export const optionalParameterPackageCheckerRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/optional-parameter-installed-contract.mjs"
		, "tests/helpers/optional-parameter-language-report.mjs"
		, "tests/helpers/optional-parameter-managed-report.mjs"
		, "tests/helpers/optional-parameter-native-report.mjs"
		, "tests/optional-parameter-installed-contract.test.mjs"
		, "tests/optional-parameter-native-installed.test.mjs"
	]);
export const optionalParameterPackageCheckerRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const optionalParameterPackageCheckerRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-package-checker-repair-source-history.mjs"
		, "tests/helpers/optional-parameter-package-checker-repair-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-package-checker-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterPackageCheckerRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterPackageCheckerRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: optionalParameterPackageCheckerRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => optionalParameterPackageCheckerRepairImplementationPaths
	.includes(path) || optionalParameterPackageCheckerRepairIntegrationPaths
	.includes(path);

/**
 * Reverse one exact authenticated checker transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterPackageCheckerRepairUpdate = (
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
 * Remove the checker repair from current or historical source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterPackageCheckerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterPackageCheckerRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseOptionalParameterPackageCheckerRepairUpdate(
			current, update);
	}
	return current;
};
