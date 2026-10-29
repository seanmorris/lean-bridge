/**
 * Preserve the optional-parameter Perl Unicode-default repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterPerlUnicodeDefaultRepairHistoryPath
	= "docs/evidence/optional-parameter-perl-unicode-default-repair-source-history-20261029.json";
export const optionalParameterPerlUnicodeDefaultRepairPredecessor
	= "f4704b4ad1f6dd657d691aebc51762757ce93847";
export const optionalParameterPerlUnicodeDefaultRepairImplementationCommits
	= Object.freeze([
		"b4c6a498d2338d91b9fe9b616ccd017c08fc168e"
		, "3a10d60f4c3ec6161d9bf4a9265ca8521b41c22f"
	]);
export const optionalParameterPerlUnicodeDefaultRepairImplementation
	= optionalParameterPerlUnicodeDefaultRepairImplementationCommits.at(-1);
export const optionalParameterPerlUnicodeDefaultRepairImplementationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "src/backends/perl/generate.mjs"
		, "tests/perl-contract.test.mjs"
	]);
export const optionalParameterPerlUnicodeDefaultRepairImplementationAdditions
	= Object.freeze([
		"scripts/refresh-optional-parameter-perl-unicode-default-pins.mjs"
	]);
export const optionalParameterPerlUnicodeDefaultRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/optional-parameter-installed-acceptance-repair-source-history-tests.mjs"
	]);
export const optionalParameterPerlUnicodeDefaultRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-perl-unicode-default-repair-source-history.mjs"
		, "tests/helpers/optional-parameter-perl-unicode-default-repair-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-perl-unicode-default-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterPerlUnicodeDefaultRepairHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterPerlUnicodeDefaultRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: optionalParameterPerlUnicodeDefaultRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	optionalParameterPerlUnicodeDefaultRepairImplementationPaths.includes(path)
	|| optionalParameterPerlUnicodeDefaultRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact Perl Unicode-default repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterPerlUnicodeDefaultRepairUpdate = (
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
 * Remove the exact Perl Unicode-default repair transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterPerlUnicodeDefaultRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterPerlUnicodeDefaultRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterPerlUnicodeDefaultRepairUpdate(
				current, update);
	}
	return current;
};
