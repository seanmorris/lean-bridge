/**
 * Reverse the installed Perl callback Fin runtime completion: checked closure
 * calls, directional converters and typed host recovery descriptors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinPerlRuntimeHistoryPath
	= "docs/evidence/callback-fin-perl-runtime-source-history-20261028.json";
export const callbackFinPerlRuntimePredecessor
	= "edb9dea662124fcb3918f394a2330ca2b590f5a9";
export const callbackFinPerlRuntimeImplementation
	= "c9bff3ec81fdcddd2aa0f39a2e617f17e8f76a46";
export const callbackFinPerlRuntimeChangedPaths = Object.freeze([
	"src/backends/perl/generate.mjs"
	, "tests/callback-fin-perl-package.test.mjs"
]);
export const callbackFinPerlRuntimeIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/callback-fin-host-repair-source-history-tests.mjs"
	, "tests/helpers/callback-fin-perl-direction-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackFinPerlRuntimeNormalizationPaths = Object.freeze([
	...callbackFinPerlRuntimeChangedPaths
	, ...callbackFinPerlRuntimeIntegrationPaths
].toSorted());
export const callbackFinPerlRuntimeAddedPaths = Object.freeze([
	"scripts/update-callback-fin-perl-runtime-source-history.mjs"
	, "tests/helpers/callback-fin-perl-runtime-source-history-tests.mjs"
	, "tests/helpers/callback-fin-perl-runtime-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinPerlRuntimeHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackFinPerlRuntimeUpdate = (source, update) => {
	assert.ok(callbackFinPerlRuntimeNormalizationPaths.includes(update.path));
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
 * Remove only the exact Perl callback Fin runtime completion transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackFinPerlRuntimeSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackFinPerlRuntimeNormalizationPaths.includes(path))
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
		current = reverseCallbackFinPerlRuntimeUpdate(current, update);
	}
	return current;
};
