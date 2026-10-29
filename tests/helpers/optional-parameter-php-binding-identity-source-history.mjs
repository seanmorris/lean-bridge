/**
 * Preserve the exact optional-parameter PHP binding-identity repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterPhpBindingIdentityHistoryPath
	= "docs/evidence/optional-parameter-php-binding-identity-source-history-20261029.json";
export const optionalParameterPhpBindingIdentityPredecessor
	= "22dea36cae11f28d42dfabbc3daec4204dea9295";
export const optionalParameterPhpBindingIdentityImplementation
	= "2d2e68726242e78f1ce0ae4a6ced0471fd3f2727";
export const optionalParameterPhpBindingIdentityImplementationPaths
	= Object.freeze([
		"tests/helpers/optional-parameter-php-tests.mjs"
		, "tests/optional-parameter-php-installed.test.mjs"
	]);
export const optionalParameterPhpBindingIdentityIntegrationPaths
	= Object.freeze(["tests/canonical-package-manifest.test.mjs"]);
export const optionalParameterPhpBindingIdentityHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-php-binding-identity-source-history.mjs"
		, "tests/helpers/optional-parameter-php-binding-identity-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-php-binding-identity-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterPhpBindingIdentityHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterPhpBindingIdentityNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: optionalParameterPhpBindingIdentityImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => optionalParameterPhpBindingIdentityImplementationPaths
	.includes(path) || optionalParameterPhpBindingIdentityIntegrationPaths
	.includes(path);

/**
 * Reverse one exact PHP binding-identity transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterPhpBindingIdentityUpdate = (
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
 * Remove the repair from current or historical source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterPhpBindingIdentitySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterPhpBindingIdentityNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseOptionalParameterPhpBindingIdentityUpdate(
			current, update);
	}
	return current;
};
