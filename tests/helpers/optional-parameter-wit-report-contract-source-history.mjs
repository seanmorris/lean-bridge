/**
 * Preserve the exact optional-parameter WIT report contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterWitReportContractHistoryPath
	= "docs/evidence/optional-parameter-wit-report-contract-source-history-20261029.json";
export const optionalParameterWitReportContractPredecessor
	= "7e1a032e436380db27312d4ecdd848de68cfd9ea";
export const optionalParameterWitReportContractImplementation
	= "57faade437b7068f27d82ddf7d15201494923e79";
export const optionalParameterWitReportContractImplementationPaths
	= Object.freeze([
		"tests/helpers/optional-parameter-wit-report.mjs"
		, "tests/helpers/optional-parameter-wit-tests.mjs"
	]);
export const optionalParameterWitReportContractIntegrationPaths
	= Object.freeze(["tests/canonical-package-manifest.test.mjs"]);
export const optionalParameterWitReportContractHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-wit-report-contract-source-history.mjs"
		, "tests/helpers/optional-parameter-wit-report-contract-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-wit-report-contract-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterWitReportContractHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterWitReportContractNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: optionalParameterWitReportContractImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => optionalParameterWitReportContractImplementationPaths
	.includes(path) || optionalParameterWitReportContractIntegrationPaths
	.includes(path);

/**
 * Reverse one exact WIT report-contract transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterWitReportContractUpdate = (
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
export const beforeOptionalParameterWitReportContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterWitReportContractNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseOptionalParameterWitReportContractUpdate(
			current, update);
	}
	return current;
};
