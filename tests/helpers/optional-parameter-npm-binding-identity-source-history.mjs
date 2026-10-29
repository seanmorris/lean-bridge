/**
 * Preserve the exact optional-parameter npm binding-identity repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterNpmBindingIdentityHistoryPath
	= "docs/evidence/optional-parameter-npm-binding-identity-source-history-20261029.json";
export const optionalParameterNpmBindingIdentityPredecessor
	= "a4102128a4cd43e745491e9c0efe9d8aa05fa469";
export const optionalParameterNpmBindingIdentityImplementation
	= "561e6dc2de6a6a52ff7f0b61b1d1c2233e813b4f";
export const optionalParameterNpmBindingIdentityImplementationPaths
	= Object.freeze([
		"tests/optional-parameter-installed-contract.test.mjs"
		, "tests/optional-parameter-npm-installed.test.mjs"
	]);
export const optionalParameterNpmBindingIdentityIntegrationPaths
	= Object.freeze(["tests/canonical-package-manifest.test.mjs"]);
export const optionalParameterNpmBindingIdentityHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-npm-binding-identity-source-history.mjs"
		, "tests/helpers/optional-parameter-npm-binding-identity-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-npm-binding-identity-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterNpmBindingIdentityHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterNpmBindingIdentityNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: optionalParameterNpmBindingIdentityImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => optionalParameterNpmBindingIdentityImplementationPaths
	.includes(path) || optionalParameterNpmBindingIdentityIntegrationPaths
	.includes(path);

/**
 * Reverse one exact npm binding-identity transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterNpmBindingIdentityUpdate = (
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
export const beforeOptionalParameterNpmBindingIdentitySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterNpmBindingIdentityNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseOptionalParameterNpmBindingIdentityUpdate(
			current, update);
	}
	return current;
};
