/**
 * Preserve the exact optional-parameter publication preparation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterPublicationPreparationHistoryPath
	= "docs/evidence/optional-parameter-publication-preparation-source-history-20261029.json";
export const optionalParameterPublicationPreparationPredecessor
	= "6ed7c38095945cf440c7255f8e831475286b78e5";
export const optionalParameterPublicationPreparationImplementation
	= "90e61aa60664488c8d13279b4bbc41a11d2e3586";
export const optionalParameterPublicationPreparationImplementationPaths
	= Object.freeze(["tests/checked-javascript-partition-11.test.mjs"]);
export const optionalParameterPublicationPreparationImplementationAdditions
	= Object.freeze([
		"scripts/promote-optional-parameter-complete.mjs"
		, "tests/helpers/optional-parameter-complete-documentation-tests.mjs"
		, "tests/helpers/optional-parameter-complete-documentation.mjs"
		, "tests/helpers/optional-parameter-complete-promotion-transaction-tests.mjs"
	]);
export const optionalParameterPublicationPreparationIntegrationPaths
	= Object.freeze(["tests/canonical-package-manifest.test.mjs"]);
export const optionalParameterPublicationPreparationHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-publication-preparation-source-history.mjs"
		, "tests/helpers/optional-parameter-publication-preparation-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-publication-preparation-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterPublicationPreparationHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterPublicationPreparationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: optionalParameterPublicationPreparationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => optionalParameterPublicationPreparationImplementationPaths
	.includes(path) || optionalParameterPublicationPreparationIntegrationPaths
	.includes(path);

/**
 * Reverse one exact publication-preparation transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterPublicationPreparationUpdate = (
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
export const beforeOptionalParameterPublicationPreparationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterPublicationPreparationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseOptionalParameterPublicationPreparationUpdate(
			current, update);
	}
	return current;
};
