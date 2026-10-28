/**
 * Reverse the installed callback-Fin Ruby and Perl host repairs without
 * rewriting the earlier callback admission or its hosted evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinHostRepairHistoryPath
	= "docs/evidence/callback-fin-host-repair-source-history-20261028.json";
export const callbackFinHostRepairPredecessor
	= "0761c85474d905cb988cd68a4027748ceaa4a460";
export const callbackFinHostRepairImplementation
	= "648da4d2cee5a1ec94d955c5a229964445702339";
export const callbackFinHostRepairChangedPaths = Object.freeze([
	"src/backends/perl/generate.mjs"
	, "tests/callback-fin-language-package.test.mjs"
	, "tests/callback-fin-perl-package.test.mjs"
	, "tests/fixtures/callback-fin-consumers/ruby.rb"
]);
export const callbackFinHostRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackFinHostRepairNormalizationPaths = Object.freeze([
	...callbackFinHostRepairChangedPaths
	, ...callbackFinHostRepairIntegrationPaths
].toSorted());
export const callbackFinHostRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-callback-fin-host-repair-source-history.mjs"
	, "tests/helpers/callback-fin-host-repair-source-history-tests.mjs"
	, "tests/helpers/callback-fin-host-repair-source-history.mjs"
]);
export const callbackFinHostRepairAddedPaths
	= callbackFinHostRepairHistoryAddedPaths;

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinHostRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackFinHostRepairUpdate = (source, update) => {
	assert.ok(callbackFinHostRepairNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact callback-Fin host repair transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackFinHostRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackFinHostRepairNormalizationPaths.includes(path))
		return source;
	const value = record(), updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCallbackFinHostRepairUpdate(current, update);
	}
	return current;
};
