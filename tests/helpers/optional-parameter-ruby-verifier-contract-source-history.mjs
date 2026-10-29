/**
 * Preserve the exact optional-parameter Ruby verifier contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterRubyVerifierContractHistoryPath
	= "docs/evidence/optional-parameter-ruby-verifier-contract-source-history-20261029.json";
export const optionalParameterRubyVerifierContractPredecessor
	= "ec9367ffc7b86cae8f62be93a23cbd537644508e";
export const optionalParameterRubyVerifierContractImplementation
	= "42616f62e02dcb294d922ad58a7f33949ddd624e";
export const optionalParameterRubyVerifierContractImplementationPaths
	= Object.freeze([
		"tests/helpers/optional-parameter-installed-contract.mjs"
		, "tests/optional-parameter-installed-contract.test.mjs"
	]);
export const optionalParameterRubyVerifierContractIntegrationPaths
	= Object.freeze(["tests/canonical-package-manifest.test.mjs"]);
export const optionalParameterRubyVerifierContractHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-ruby-verifier-contract-source-history.mjs"
		, "tests/helpers/optional-parameter-ruby-verifier-contract-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-ruby-verifier-contract-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterRubyVerifierContractHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterRubyVerifierContractNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: optionalParameterRubyVerifierContractImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => optionalParameterRubyVerifierContractImplementationPaths
	.includes(path) || optionalParameterRubyVerifierContractIntegrationPaths
	.includes(path);

/**
 * Reverse one exact Ruby verifier-contract transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterRubyVerifierContractUpdate = (
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
export const beforeOptionalParameterRubyVerifierContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterRubyVerifierContractNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseOptionalParameterRubyVerifierContractUpdate(
			current, update);
	}
	return current;
};
